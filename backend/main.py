import asyncio
import base64
import json
import logging
import os
import re
import time
from typing import Any, Optional

from database import (
    authenticate_patient,
    get_doctor_lab_reports,
    get_latest_consultation_for_doctor,
    get_patient_by_mobile,
    get_latest_consultation,
    get_patient_message_history,
    get_pending_escalations,
    get_patient_history,
    init_db,
    save_care_plan,
    save_consultation,
    save_doctor_reply,
    save_lab_report,
    save_patient_message,
)
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI


load_dotenv()

logger = logging.getLogger(__name__)
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "").strip()
client = AsyncOpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

app = FastAPI(title="Elfie Clinical OS API")
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Elfie Intelligence API is running. Visit /docs for endpoints."}


def _safe_json_object(payload: str) -> dict[str, Any]:
    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _extract_message_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text_value = item.get("text")
                if isinstance(text_value, str):
                    parts.append(text_value)
        return "\n".join(part for part in parts if part).strip()
    return ""


def _start_timing_log(event: str, **context: Any) -> float:
    logger.info("%s started | %s", event, context)
    return time.perf_counter()


def _finish_timing_log(started_at: float, event: str, **context: Any) -> None:
    elapsed_ms = round((time.perf_counter() - started_at) * 1000, 1)
    logger.info("%s finished in %sms | %s", event, elapsed_ms, context)


def _normalize_string(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        prioritized_keys = (
            "text",
            "value",
            "name",
            "label",
            "condition",
            "diagnosis",
            "symptom",
            "medication",
            "description",
        )
        for key in prioritized_keys:
            nested = value.get(key)
            if nested is not None:
                normalized = _normalize_string(nested)
                if normalized:
                    return normalized
        flattened = [
            _normalize_string(item)
            for item in value.values()
            if _normalize_string(item)
        ]
        return ", ".join(flattened)
    if isinstance(value, list):
        flattened = [_normalize_string(item) for item in value if _normalize_string(item)]
        return ", ".join(flattened)
    if value is None:
        return ""
    return str(value).strip()


def _normalize_string_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        values = [values]
    normalized = [_normalize_string(item) for item in values]
    return [item for item in normalized if item]


def _format_structured_prescription_items(items: Any) -> str:
    if not isinstance(items, list):
        return ""

    formatted_items: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "") or "").strip()
        dose = str(item.get("dose", "") or "").strip()
        timing = str(item.get("timing", "") or "").strip()
        food = str(item.get("food", "") or "").strip()
        selected = item.get("selected", True)

        if not selected or not name:
            continue

        segments = [name]
        if dose:
            segments.append(f"Dose: {dose}")
        if timing:
            segments.append(f"Timing: {timing}")
        if food:
            segments.append(f"Food: {food}")
        formatted_items.append(" | ".join(segments))

    return ", ".join(formatted_items)


SUPPORTED_LANGUAGE_CODES = {
    "EN": "English",
    "FR": "French",
    "AR": "Arabic",
    "VI": "Vietnamese",
}


def _resolve_language_name(language: Optional[str]) -> str:
    normalized = str(language or "").strip()
    if not normalized:
        return "English"
    upper = normalized.upper()
    if upper in SUPPORTED_LANGUAGE_CODES:
        return SUPPORTED_LANGUAGE_CODES[upper]
    if normalized in SUPPORTED_LANGUAGE_CODES.values():
        return normalized
    return normalized


def _is_missing_lab_reports_table_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "lab_reports" in message or "public.lab_reports" in message


def _build_inline_attachment(
    file_bytes: bytes,
    mime_type: str,
    max_bytes: int = 350_000,
) -> Optional[str]:
    if not mime_type.startswith("image/"):
        return None
    if len(file_bytes) > max_bytes:
        return None
    return f"data:{mime_type};base64,{base64.b64encode(file_bytes).decode('utf-8')}"


async def transcribe_medical_audio(
    audio_bytes: bytes,
    mime_type: str,
    target_language: str,
) -> str:
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DashScope Qwen ASR is not configured.")

    data_uri = f"data:{mime_type};base64,{base64.b64encode(audio_bytes).decode('utf-8')}"
    response = await client.chat.completions.create(
        model="qwen3-asr-flash",
        messages=[
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Listen to this audio. The patient may speak in English, French, Arabic, or Vietnamese. "
                            f"Transcribe the audio perfectly in its original language, but translate the structured JSON output "
                            f"(symptoms, diagnosis, etc.) into the requested target language: {target_language}. "
                            "For this step, only return the highly accurate verbatim transcript in the original spoken language. "
                            "Do not add any extra formatting."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [{"audio": data_uri}],
            },
        ],
    )
    transcript = _extract_message_content(response.choices[0].message.content)
    transcript = transcript.strip()
    if not transcript:
        raise RuntimeError("Qwen ASR did not return a transcript for the uploaded audio.")
    return transcript


def _format_patient_summary(consultation: dict[str, Any]) -> str:
    care_plan = consultation.get("care_plan", {}) if isinstance(consultation, dict) else {}
    care_plan_summary = str(care_plan.get("summary", "")).strip()
    if care_plan_summary:
        return care_plan_summary

    diagnosis = str(consultation.get("diagnosis", "")).strip() or "your recent condition"
    prescription = str(consultation.get("final_prescription", "")).strip()
    symptoms = str(consultation.get("symptoms", "")).strip()

    summary = f"Your doctor diagnosed {diagnosis}."
    if symptoms:
        summary += f" Reported symptoms included {symptoms}."
    if prescription:
        summary += f" Your prescribed treatment is: {prescription}."
    summary += " Please continue following your doctor's instructions and use the secure update form below if anything changes."
    return summary


async def _draft_doctor_reply(
    message: str,
    diagnosis: str,
    image_base64: Optional[str] = None,
) -> dict[str, str]:
    fallback_reply = (
        "Thanks for the update. Please continue your current treatment plan while I review this change in your symptoms."
    )
    fallback_advice = (
        "Review symptom progression, assess whether medication intolerance is possible, and consider whether an in-person review is needed."
    )

    if not DASHSCOPE_API_KEY:
        return {
            "suggested_reply": fallback_reply,
            "clinical_advice": fallback_advice,
        }

    lowered_message = message.lower()
    if "lab report sent to" in lowered_message or len(message) > 1200:
        return {
            "suggested_reply": (
                "Thank you for sending your report. I have reviewed the summary and will let you know if any follow-up tests or treatment changes are needed."
            ),
            "clinical_advice": (
                "Review the AI lab summary, confirm whether the abnormal values require repeat testing, and message the patient with next steps."
            ),
        }

    system_prompt = (
        "You are a Clinical Co-Pilot. Draft a short, professional response for the "
        "doctor to send back, and suggest if a medication change or in-person visit "
        'is needed. Return JSON: {"suggested_reply": "...", "clinical_advice": "..."}'
    )
    user_content: Any = (
        "The patient says: "
        f"\"{message}\". They provided an image if available. Their original diagnosis was {diagnosis}."
    )
    model_name = "qwen-max"
    if image_base64:
        model_name = "qwen-vl-max"
        user_content = [
            {
                "type": "text",
                "text": (
                    "Analyze this data: "
                    f'The patient says "{message}". Their original diagnosis was {diagnosis}.'
                ),
            },
            {
                "type": "image_url",
                "image_url": {"url": image_base64},
            },
        ]

    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
            ),
            timeout=6,
        )
        content = _extract_message_content(response.choices[0].message.content)
        content = re.sub(
            r"^```(?:json)?\s*|\s*```$",
            "",
            content.strip(),
            flags=re.IGNORECASE,
        )
        parsed = _safe_json_object(content)
    except (asyncio.TimeoutError, TypeError, ValueError, AttributeError) as exc:
        logger.exception("Failed to draft Qwen doctor reply: %s", exc)
        parsed = {}

    return {
        "suggested_reply": str(parsed.get("suggested_reply", fallback_reply)),
        "clinical_advice": str(parsed.get("clinical_advice", fallback_advice)),
    }


async def generate_care_plan(
    diagnosis: str,
    symptoms: str,
    final_prescription: str,
    doctor_name: str,
) -> dict[str, str]:
    fallback_summary = (
        f"{doctor_name or 'Your doctor'} reviewed your symptoms and treatment plan carefully. "
        f"The final diagnosis is {diagnosis}, and your prescribed medications are {final_prescription}."
    )
    fallback_day_3_question = (
        "By day 3, are your main symptoms improving, staying the same, or getting worse?"
    )
    fallback_explanation = (
        f"{doctor_name or 'Your doctor'} matched your reported symptoms of {symptoms or 'the current illness'} "
        f"with the diagnosis of {diagnosis}. The medications were selected to target the likely cause of the illness "
        f"and relieve symptoms safely: {final_prescription}."
    )

    if not DASHSCOPE_API_KEY:
        return {
            "summary": fallback_summary,
            "day_3_question": fallback_day_3_question,
            "ai_patient_explanation": fallback_explanation,
        }

    system_prompt = (
        "You are a patient-education AI. Read the doctor's diagnosis, symptoms, and final "
        "prescription. Generate a comforting, plain-language explanation addressing the patient "
        "directly. Explain EXACTLY how the doctor arrived at this diagnosis based on their symptoms, "
        'and why the specific medications were chosen. Return JSON: {"summary": "...", '
        '"day_3_question": "...", "ai_patient_explanation": "..."}'
    )
    payload = {
        "doctor_name": doctor_name,
        "diagnosis": diagnosis,
        "symptoms": symptoms,
        "final_prescription": final_prescription,
    }

    try:
        response = await client.chat.completions.create(
            model="qwen-max",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(payload)},
            ],
        )
        content = _extract_message_content(response.choices[0].message.content)
        content = re.sub(
            r"^```(?:json)?\s*|\s*```$",
            "",
            content.strip(),
            flags=re.IGNORECASE,
        )
        parsed = _safe_json_object(content)
    except (TypeError, ValueError, AttributeError) as exc:
        logger.exception("Failed to generate Qwen patient care plan: %s", exc)
        parsed = {}

    return {
        "summary": str(parsed.get("summary", fallback_summary)),
        "day_3_question": str(parsed.get("day_3_question", fallback_day_3_question)),
        "ai_patient_explanation": str(
            parsed.get("ai_patient_explanation", fallback_explanation)
        ),
    }


async def _enrich_pending_messages(
    doctor_name: Optional[str] = None,
) -> list[dict[str, Any]]:
    pending_messages = await get_pending_escalations(doctor_name=doctor_name)
    draft_tasks = [
        _draft_doctor_reply(
            message=message.get("message", ""),
            diagnosis=message.get("diagnosis", ""),
            image_base64=message.get("image_base64") or None,
        )
        for message in pending_messages
    ]
    ai_drafts = await asyncio.gather(*draft_tasks)

    return [
        {
            **message,
            "suggested_reply": ai_draft["suggested_reply"],
            "clinical_advice": ai_draft["clinical_advice"],
        }
        for message, ai_draft in zip(pending_messages, ai_drafts)
    ]


def _fallback_entities(
    transcript: str,
    doctor_notes: Optional[str] = None,
    language: Optional[str] = None,
) -> dict[str, Any]:
    lowered = transcript.lower()
    notes_lowered = (doctor_notes or "").lower()
    symptoms: list[str] = []
    red_flags: list[str] = []

    if "sore throat" in lowered:
        symptoms.append("Sore throat")
    if "fever" in lowered:
        symptoms.append("Fever")
    if "painful swallowing" in lowered:
        symptoms.append("Painful swallowing")
    if "fatigue" in lowered:
        symptoms.append("Fatigue")
    if "shortness of breath" in lowered:
        red_flags.append("Evaluate for shortness of breath or respiratory distress")
    if "worsen at night" in lowered or "inhaler" in lowered:
        red_flags.append("Assess for nocturnal respiratory symptoms or reactive airway disease")

    diagnosis = "Acute pharyngitis"
    if "asthma" in notes_lowered:
        diagnosis = "Possible early stage asthma"
        symptoms = list(
            dict.fromkeys(
                symptoms
                + [
                    "Possible wheeze or airway sensitivity under review",
                    "Night-time respiratory symptom screening recommended",
                ]
            )
        )
        red_flags.append("Watch for worsening wheeze, chest tightness, or reduced oxygenation")

    return {
        "chief_complaint": "Sore throat with fever",
        "symptoms": symptoms or ["Symptoms under review"],
        "diagnosis": diagnosis,
        "suggested_medications": [
            "Amoxicillin 500mg 3x/day",
            "Paracetamol 500mg every 6 hours as needed",
            "Warm saline gargles twice daily",
        ],
        "red_flags": list(dict.fromkeys(red_flags))
        or ["Escalate if breathing difficulty, dehydration, or clinical deterioration develops"],
        "language": language or "English",
        "doctor_notes_used": doctor_notes or "",
    }


def _sanitize_clinical_payload(
    parsed: dict[str, Any],
    transcript: str,
    doctor_notes: Optional[str],
    language: Optional[str],
) -> dict[str, Any]:
    return {
        "chief_complaint": _normalize_string(parsed.get("chief_complaint", "")),
        "symptoms": _normalize_string_list(parsed.get("symptoms", [])),
        "diagnosis": _normalize_string(parsed.get("diagnosis", "")),
        "suggested_medications": _normalize_string_list(
            parsed.get("suggested_medications", [])
        ),
        "red_flags": _normalize_string_list(parsed.get("red_flags", [])),
        "doctor_notes_used": _normalize_string(
            parsed.get("doctor_notes_used", doctor_notes or "")
        ),
        "language": _normalize_string(parsed.get("language", language or "English")),
        "transcript": transcript,
    }


async def extract_clinical_entities(
    transcript: str,
    image_base64: Optional[str] = None,
    image_mime_type: Optional[str] = None,
    doctor_notes: Optional[str] = None,
    language: Optional[str] = None,
) -> dict[str, Any]:
    resolved_language = _resolve_language_name(language)
    fallback = _fallback_entities(
        transcript, doctor_notes=doctor_notes, language=resolved_language
    )
    if not DASHSCOPE_API_KEY:
        return {**fallback, "transcript": transcript}

    system_prompt = (
        "You are a Clinical Intelligence Engine. You will receive a raw transcript of a "
        "live consultation. You must differentiate between the Doctor and the Patient "
        'based on context. You will also receive "Doctor\'s Additional Notes". '
        "Treat the doctor notes as high-priority clinical context that should materially "
        "refine the diagnosis, differential weighting, and red_flags logic when supported "
        "by the consultation. Extract only clinician-facing structured output for a "
        "licensed doctor to review. CRITICAL: For symptoms and prescribed_medications, "
        'return a flat array of simple strings (e.g., ["Fever", "Headache"]). DO NOT '
        "return arrays of objects. For diagnosis, return a single descriptive string, NOT "
        "an object. Return STRICTLY valid JSON. "
        f"CRITICAL: You MUST translate the entire JSON response (symptoms, diagnosis, medications, treatment plan) into the requested language: {resolved_language}. "
        f"The JSON keys must remain in English, but the values MUST be in {resolved_language}."
    )

    user_payload = {
        "language": resolved_language,
        "transcript": transcript,
        "doctor_notes": doctor_notes or "",
        "instructions": [
            "Perform speaker-aware reasoning and separate likely doctor questions from patient-reported symptoms.",
            "Use the doctor notes heavily when determining the most likely diagnosis and clinically relevant red flags.",
            "If an image is provided, use it as supporting evidence only.",
            f"Listen to this audio. The patient may speak in English, French, Arabic, or Vietnamese. Transcribe the audio perfectly in its original language, but translate the structured JSON output (symptoms, diagnosis, etc.) into the requested target language: {resolved_language}.",
            "Return keys: chief_complaint, symptoms, diagnosis, suggested_medications, red_flags, doctor_notes_used, language.",
            "suggested_medications should contain 3 to 5 draft medications with typical dosage wording when appropriate.",
            "All arrays must be arrays of flat strings only. No nested objects, no maps, no JSON objects inside arrays.",
        ],
    }
    model_name = "qwen-max"
    user_content: Any = json.dumps(user_payload)
    if image_base64 and image_mime_type:
        model_name = "qwen-vl-max"
        image_url = image_base64
        if not image_base64.startswith("data:"):
            image_url = f"data:{image_mime_type};base64,{image_base64}"
        user_content = [
            {"type": "text", "text": "Analyze this data: " + json.dumps(user_payload)},
            {"type": "image_url", "image_url": {"url": image_url}},
        ]

    try:
        response = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
        )
        content = _extract_message_content(response.choices[0].message.content)
        content = re.sub(
            r"^```(?:json)?\s*|\s*```$",
            "",
            content.strip(),
            flags=re.IGNORECASE,
        )
        parsed = _safe_json_object(content)
        if not parsed:
            return {**fallback, "transcript": transcript}
        return _sanitize_clinical_payload(
            parsed,
            transcript,
            doctor_notes=doctor_notes,
            language=resolved_language,
        )
    except (TypeError, ValueError, AttributeError) as exc:
        logger.exception("Failed to parse Qwen clinical response: %s", exc)
        return {**fallback, "transcript": transcript}


@app.post("/api/transcribe")
async def transcribe_audio(
    name: str = Form(...),
    mobile_number: str = Form(...),
    audio: UploadFile = File(...),
    image: Optional[UploadFile] = File(None),
    language: str = Form("English"),
    doctor_notes: Optional[str] = Form(None),
):
    try:
        if not name.strip():
            raise HTTPException(status_code=400, detail="Patient name is required.")
        if not mobile_number.strip():
            raise HTTPException(status_code=400, detail="Mobile number is required.")

        audio_bytes = await audio.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Audio upload is required.")

        transcript = await transcribe_medical_audio(
            audio_bytes=audio_bytes,
            mime_type=audio.content_type or "audio/webm",
            target_language=_resolve_language_name(language),
        )

        image_base64: Optional[str] = None
        image_mime_type: Optional[str] = None
        if image is not None:
            image_bytes = await image.read()
            if image_bytes:
                image_base64 = base64.b64encode(image_bytes).decode("utf-8")
                image_mime_type = image.content_type or "image/jpeg"

        extracted = await extract_clinical_entities(
            transcript=transcript,
            image_base64=image_base64,
            image_mime_type=image_mime_type,
            doctor_notes=doctor_notes,
            language=language,
        )

        clinical_data = {
            "chief_complaint": str(extracted.get("chief_complaint", "")),
            "symptoms": extracted.get("symptoms", []),
            "diagnosis": str(extracted.get("diagnosis", "")),
            "suggested_medications": extracted.get("suggested_medications", []),
            "red_flags": extracted.get("red_flags", []),
        }

        return {
            "name": name,
            "mobile_number": mobile_number,
            "language": language,
            "doctor_notes": doctor_notes or "",
            "transcript": transcript,
            "clinical_data": clinical_data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        await audio.close()
        if image is not None:
            await image.close()


@app.post("/api/save")
async def save_patient_record(payload: dict[str, Any]):
    try:
        name = str(payload.get("name", "")).strip()
        mobile_number = str(payload.get("mobile_number", "")).strip()
        doctor_name = str(payload.get("doctor_name", "")).strip()
        doctor_notes = str(payload.get("doctor_notes", "")).strip()
        transcript = str(payload.get("transcript", "")).strip()
        diagnosis = str(payload.get("diagnosis", "")).strip()

        symptoms_value = payload.get("symptoms", [])
        if isinstance(symptoms_value, list):
            symptoms = ", ".join(
                str(item) for item in symptoms_value if str(item).strip()
            )
        else:
            symptoms = str(symptoms_value or "").strip()

        structured_prescription_value = payload.get("final_prescription_structured", [])
        final_prescription = _format_structured_prescription_items(
            structured_prescription_value
        )
        if not final_prescription:
            final_prescription_value = payload.get("final_prescription", [])
            if isinstance(final_prescription_value, list):
                final_prescription = ", ".join(
                    str(item) for item in final_prescription_value if str(item).strip()
                )
            else:
                final_prescription = str(final_prescription_value or "").strip()

        if not name:
            raise HTTPException(status_code=400, detail="Patient name is required.")
        if not mobile_number:
            raise HTTPException(status_code=400, detail="Mobile number is required.")
        if not doctor_name:
            raise HTTPException(status_code=400, detail="Doctor name is required.")
        if not transcript:
            raise HTTPException(status_code=400, detail="Transcript is required.")
        if not diagnosis:
            raise HTTPException(status_code=400, detail="Diagnosis is required.")
        if not final_prescription:
            raise HTTPException(
                status_code=400,
                detail="At least one final prescribed medication is required.",
            )

        care_plan = await generate_care_plan(
            diagnosis=diagnosis,
            symptoms=symptoms,
            final_prescription=final_prescription,
            doctor_name=doctor_name,
        )

        consultation_id = await save_consultation(
            mobile=mobile_number,
            name=name,
            doctor_name=doctor_name,
            transcript=transcript,
            symptoms=symptoms,
            diagnosis=diagnosis,
            final_prescription=final_prescription,
            doctor_notes=doctor_notes,
        )
        await save_care_plan(
            consultation_id=consultation_id,
            summary=care_plan["summary"],
            ai_explanation=care_plan["ai_patient_explanation"],
            day_3_question=care_plan["day_3_question"],
        )

        patient_record = await get_patient_by_mobile(mobile_number)
        patient = patient_record.get("patient", {}) if patient_record else {}
        patient_id = str(patient.get("patient_id", "")).strip()

        return {
            "success": True,
            "patient_id": patient_id,
            "consultation_id": consultation_id,
            "care_plan": care_plan,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/patient/login")
async def patient_login(payload: dict[str, Any]):
    patient_id = str(payload.get("patient_id", "")).strip()
    mobile_number = str(payload.get("mobile_number", "")).strip()

    if not patient_id or not mobile_number:
        raise HTTPException(
            status_code=400,
            detail="Patient ID and mobile number are required.",
        )

    patient = await authenticate_patient(patient_id, mobile_number)
    if patient is None:
        raise HTTPException(status_code=401, detail="Invalid patient credentials.")

    return {"success": True, "name": patient["name"]}


@app.get("/api/patient/{patient_id}/dashboard")
async def patient_dashboard(patient_id: str):
    try:
        consultation = await get_latest_consultation(patient_id)
        if consultation is None:
            raise HTTPException(status_code=404, detail="No consultation found.")

        return {
            "doctor_name": str(consultation.get("doctor_name", "") or ""),
            "diagnosis": str(consultation.get("diagnosis", "") or ""),
            "final_prescription": str(
                consultation.get("final_prescription", "") or ""
            ),
            "timestamp": str(consultation.get("timestamp", "") or ""),
            "patient_friendly_summary": _format_patient_summary(consultation),
            "doctor_reply": str(consultation.get("doctor_reply", "") or ""),
            "day_3_question": str(
                consultation.get("care_plan", {}).get("day_3_question", "") or ""
            ),
            "ai_patient_explanation": consultation.get("care_plan", {}).get(
                "ai_patient_explanation", ""
            )
            or "",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/patient/check-in")
async def patient_check_in(
    patient_id: str = Form(...),
    message: str = Form(...),
    image: Optional[UploadFile] = File(None),
):
    try:
        if not patient_id.strip():
            raise HTTPException(status_code=400, detail="Patient ID is required.")
        if not message.strip():
            raise HTTPException(status_code=400, detail="Message is required.")

        image_base64: Optional[str] = None
        if image is not None:
            image_bytes = await image.read()
            if image_bytes:
                mime_type = image.content_type or "image/jpeg"
                image_base64 = (
                    f"data:{mime_type};base64,"
                    f"{base64.b64encode(image_bytes).decode('utf-8')}"
                )

        latest_consultation = await get_latest_consultation(patient_id.strip())
        if latest_consultation is None:
            raise HTTPException(status_code=404, detail="No consultation found.")

        consultation_id = int(latest_consultation.get("id", 0) or 0)
        if not consultation_id:
            raise HTTPException(status_code=500, detail="Invalid consultation reference.")

        await save_patient_message(
            patient_id=patient_id.strip(),
            consultation_id=consultation_id,
            message=message.strip(),
            image_base64=image_base64,
        )
        return {
            "success": True,
            "message": "Your update has been securely forwarded to your doctor.",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if image is not None:
            await image.close()


async def analyze_lab_report_with_ai(
    file_bytes: bytes,
    mime_type: str,
    language: str,
) -> dict[str, str]:
    resolved_language = _resolve_language_name(language)
    fallback = {
        "purpose_of_test": f"Lab report summary prepared in {resolved_language}.",
        "what_the_report_says": "The uploaded report was received and is awaiting full AI interpretation.",
        "concerns_and_abnormals": "Please review any values marked high, low, positive, or out of range with your doctor.",
        "not_a_concern": "Normal or stable values are typically reassuring unless your doctor says otherwise.",
        "patient_friendly_summary": "Your lab report has been uploaded securely. A clinician should review any abnormal findings with you directly.",
    }

    if not DASHSCOPE_API_KEY:
        return fallback

    system_prompt = (
        "You are an expert Labs Analyzer. Read this medical report. Generate a patient-friendly "
        f"summary in {resolved_language}. Return STRICTLY JSON: "
        '{"purpose_of_test": "...", "what_the_report_says": "...", "concerns_and_abnormals": "...", '
        '"not_a_concern": "...", "patient_friendly_summary": "..."}'
    )

    try:
        file_url = f"data:{mime_type};base64,{base64.b64encode(file_bytes).decode('utf-8')}"
        response = await client.chat.completions.create(
            model="qwen-vl-max",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Analyze this data: medical report uploaded by the patient.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": file_url},
                        },
                    ],
                },
            ],
        )
        content = _extract_message_content(response.choices[0].message.content)
        content = re.sub(
            r"^```(?:json)?\s*|\s*```$",
            "",
            content.strip(),
            flags=re.IGNORECASE,
        )
        parsed = _safe_json_object(content)
    except (TypeError, ValueError, AttributeError) as exc:
        logger.exception("Failed to analyze lab report with Qwen: %s", exc)
        parsed = {}

    return {
        "purpose_of_test": str(parsed.get("purpose_of_test", fallback["purpose_of_test"]) or ""),
        "what_the_report_says": str(parsed.get("what_the_report_says", fallback["what_the_report_says"]) or ""),
        "concerns_and_abnormals": str(parsed.get("concerns_and_abnormals", fallback["concerns_and_abnormals"]) or ""),
        "not_a_concern": str(parsed.get("not_a_concern", fallback["not_a_concern"]) or ""),
        "patient_friendly_summary": str(parsed.get("patient_friendly_summary", fallback["patient_friendly_summary"]) or ""),
    }


@app.post("/api/patient/analyze-lab")
async def analyze_lab_report(
    file: UploadFile = File(...),
    language: str = Form("EN"),
):
    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Lab report file is required.")

        mime_type = file.content_type or "application/pdf"
        if not (
            mime_type.startswith("image/") or mime_type == "application/pdf"
        ):
            raise HTTPException(
                status_code=400,
                detail="Please upload a PDF or image lab report.",
            )

        analysis = await analyze_lab_report_with_ai(
            file_bytes=file_bytes,
            mime_type=mime_type,
            language=language,
        )
        return {
            "language": _resolve_language_name(language),
            "analysis": analysis,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        await file.close()


@app.post("/api/patient/send-lab")
async def send_lab_report_to_doctor(
    patient_id: str = Form(...),
    doctor_name: str = Form(...),
    language: str = Form("EN"),
    ai_analysis: str = Form(...),
    file: UploadFile = File(...),
):
    started_at = _start_timing_log(
        "patient_send_lab",
        patient_id=patient_id,
        doctor_name=doctor_name,
        language=language,
        filename=getattr(file, "filename", ""),
    )
    try:
        if not patient_id.strip():
            raise HTTPException(status_code=400, detail="Patient ID is required.")
        if not doctor_name.strip():
            raise HTTPException(status_code=400, detail="Doctor name is required.")

        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Lab report file is required.")

        mime_type = file.content_type or "application/pdf"
        file_base64 = (
            f"data:{mime_type};base64,{base64.b64encode(file_bytes).decode('utf-8')}"
        )
        report_id: Optional[int] = None
        delivery_mode = "lab_reports"
        try:
            report_id = await save_lab_report(
                patient_id=patient_id.strip(),
                doctor_name=doctor_name.strip(),
                file_base64=file_base64,
                mime_type=mime_type,
                ai_analysis=ai_analysis.strip(),
            )
        except Exception as exc:
            if not _is_missing_lab_reports_table_error(exc):
                raise

            logger.warning(
                "lab_reports table unavailable, falling back to patient_messages escalation: %s",
                exc,
            )
            latest_consultation = await get_latest_consultation_for_doctor(
                patient_id.strip(),
                doctor_name.strip(),
            )
            if latest_consultation is None:
                latest_consultation = await get_latest_consultation(patient_id.strip())
            if latest_consultation is None:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Lab reports storage is not configured yet and no active consultation "
                        "was found for fallback delivery."
                    ),
                ) from exc

            consultation_id = int(latest_consultation.get("id", 0) or 0)
            if not consultation_id:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Lab reports storage is not configured yet and the consultation "
                        "reference is invalid for fallback delivery."
                    ),
                ) from exc

            parsed_analysis = _safe_json_object(ai_analysis.strip())
            summary = _normalize_string(
                parsed_analysis.get("patient_friendly_summary")
                or parsed_analysis.get("what_the_report_says")
                or "Patient uploaded a lab report for doctor review."
            )
            fallback_message = (
                f"Lab report sent to {doctor_name.strip()} for review. "
                f"AI summary: {summary}"
            )
            await save_patient_message(
                patient_id=patient_id.strip(),
                consultation_id=consultation_id,
                message=fallback_message,
                image_base64=_build_inline_attachment(file_bytes, mime_type),
            )
            delivery_mode = "fallback_message"

        return {
            "success": True,
            "report_id": report_id,
            "doctor_name": doctor_name.strip(),
            "language": _resolve_language_name(language),
            "delivery_mode": delivery_mode,
            "message": "Your report was securely routed to the doctor for review.",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unable to send lab report to doctor: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Unable to send the lab report right now. Please try again shortly.",
        ) from exc
    finally:
        _finish_timing_log(
            started_at,
            "patient_send_lab",
            patient_id=patient_id,
            doctor_name=doctor_name,
        )
        await file.close()


@app.get("/api/history/{patient_id}")
async def patient_history(patient_id: str):
    try:
        return await get_patient_history(patient_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/patient/{patient_id}/messages")
async def patient_messages(patient_id: str):
    try:
        return await get_patient_message_history(patient_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/doctor/inbox")
async def doctor_inbox(doctor_name: Optional[str] = Query(None)):
    try:
        return await _enrich_pending_messages(
            doctor_name=str(doctor_name or "").strip() or None
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/escalations")
async def escalations(doctor_name: Optional[str] = Query(None)):
    started_at = _start_timing_log(
        "doctor_escalations_poll",
        doctor_name=doctor_name,
    )
    try:
        items = await _enrich_pending_messages(
            doctor_name=str(doctor_name or "").strip() or None
        )
        return {
            "count": len(items),
            "items": items,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        _finish_timing_log(
            started_at,
            "doctor_escalations_poll",
            doctor_name=doctor_name,
        )


@app.get("/api/doctor/search")
async def doctor_search(mobile: str = Query(...)):
    try:
        if not mobile.strip():
            raise HTTPException(status_code=400, detail="Mobile number is required.")

        patient_record = await get_patient_by_mobile(mobile.strip())
        if patient_record is None:
            return {
                "found": False,
                "message": "New Patient. Proceed with Consultation intake.",
            }

        return {
            "found": True,
            "message": "Longitudinal patient record loaded.",
            **patient_record,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/doctor/lab-reports")
async def doctor_lab_reports(doctor_name: Optional[str] = Query(None)):
    try:
        items = await get_doctor_lab_reports(
            doctor_name=str(doctor_name or "").strip() or None
        )
        return {
            "count": len(items),
            "items": items,
        }
    except Exception as exc:
        logger.exception("Unable to load doctor lab reports: %s", exc)
        return {
            "count": 0,
            "items": [],
            "warning": str(exc),
        }


@app.post("/api/doctor/reply")
async def doctor_reply(payload: dict[str, Any]):
    started_at = _start_timing_log(
        "doctor_reply_submit",
        message_id=payload.get("message_id", 0),
    )
    try:
        message_id = int(payload.get("message_id", 0))
        reply_text = str(payload.get("reply_text", "")).strip()

        if not message_id:
            raise HTTPException(status_code=400, detail="Message ID is required.")
        if not reply_text:
            raise HTTPException(status_code=400, detail="Reply text is required.")

        await save_doctor_reply(message_id, reply_text)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        _finish_timing_log(
            started_at,
            "doctor_reply_submit",
            message_id=payload.get("message_id", 0),
        )
