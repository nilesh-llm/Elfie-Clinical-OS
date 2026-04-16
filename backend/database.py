from dotenv import load_dotenv
load_dotenv()
import asyncio
import os
import uuid
from typing import Any, Optional

from supabase import Client, create_client


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be configured.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def _row(response: Any) -> Optional[dict[str, Any]]:
    data = getattr(response, "data", None)
    if isinstance(data, list):
        return data[0] if data else None
    return data if isinstance(data, dict) else None


def _rows(response: Any) -> list[dict[str, Any]]:
    data = getattr(response, "data", None)
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def _normalize_care_plan_row(row: Optional[dict[str, Any]]) -> dict[str, Any]:
    if not isinstance(row, dict):
        return {
            "consultation_id": None,
            "patient_friendly_summary": "",
            "summary": "",
            "ai_patient_explanation": "",
            "day_3_question": "",
            "requires_escalation": False,
        }

    patient_friendly_summary = str(row.get("patient_friendly_summary", "") or "")
    return {
        **row,
        "patient_friendly_summary": patient_friendly_summary,
        "summary": patient_friendly_summary,
        "ai_patient_explanation": str(row.get("ai_patient_explanation", "") or ""),
        "day_3_question": str(row.get("day_3_question", "") or ""),
        "requires_escalation": bool(row.get("requires_escalation", False)),
    }


def _normalize_message_row(row: Optional[dict[str, Any]]) -> dict[str, Any]:
    if not isinstance(row, dict):
        return {
            "id": 0,
            "patient_id": "",
            "consultation_id": None,
            "message": "",
            "image_base64": "",
            "doctor_reply": "",
            "requires_doctor_review": False,
            "timestamp": "",
        }

    return {
        **row,
        "patient_id": str(row.get("patient_id", "") or ""),
        "message": str(row.get("message", "") or ""),
        "image_base64": str(row.get("image_base64", "") or ""),
        "doctor_reply": str(row.get("doctor_reply", "") or ""),
        "requires_doctor_review": bool(row.get("requires_doctor_review", False)),
        "timestamp": str(row.get("timestamp", "") or ""),
    }


def _normalize_lab_report_row(row: Optional[dict[str, Any]]) -> dict[str, Any]:
    if not isinstance(row, dict):
        return {
            "id": 0,
            "patient_id": "",
            "doctor_name": "",
            "file_base64": "",
            "mime_type": "",
            "ai_analysis": "",
            "timestamp": "",
        }

    return {
        **row,
        "patient_id": str(row.get("patient_id", "") or ""),
        "doctor_name": str(row.get("doctor_name", "") or ""),
        "file_base64": str(row.get("file_base64", "") or ""),
        "mime_type": str(row.get("mime_type", "") or ""),
        "ai_analysis": str(row.get("ai_analysis", "") or ""),
        "timestamp": str(row.get("timestamp", "") or ""),
    }


def init_db() -> None:
    # Supabase manages schema externally. We only validate connectivity config here.
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be configured.")


async def _select_patient_by_mobile(mobile: str) -> Optional[dict[str, Any]]:
    def _query() -> Optional[dict[str, Any]]:
        response = (
            supabase.table("patients")
            .select("*")
            .eq("mobile_number", mobile)
            .limit(1)
            .execute()
        )
        return _row(response)

    return await asyncio.to_thread(_query)


async def _select_patient_by_credentials(
    patient_id: str, mobile_number: str
) -> Optional[dict[str, Any]]:
    def _query() -> Optional[dict[str, Any]]:
        response = (
            supabase.table("patients")
            .select("*")
            .eq("patient_id", patient_id)
            .eq("mobile_number", mobile_number)
            .limit(1)
            .execute()
        )
        return _row(response)

    return await asyncio.to_thread(_query)


async def authenticate_patient(
    patient_id: str, mobile_number: str
) -> Optional[dict[str, Any]]:
    patient = await _select_patient_by_credentials(patient_id, mobile_number)
    if patient is None:
        return None
    return {
        "patient_id": str(patient.get("patient_id", "")),
        "name": str(patient.get("name", "")),
    }


async def get_patient_by_mobile(mobile: str) -> Optional[dict[str, Any]]:
    patient = await _select_patient_by_mobile(mobile)
    if patient is None:
        return None

    patient_id = str(patient.get("patient_id", ""))

    def _fetch_related() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        consultations_response = (
            supabase.table("consultations")
            .select("*")
            .eq("patient_id", patient_id)
            .order("timestamp", desc=True)
            .execute()
        )
        consultations = _rows(consultations_response)
        consultation_ids = [
            item.get("id") for item in consultations if item.get("id") is not None
        ]
        care_plans = []
        if consultation_ids:
            care_plans_response = (
                supabase.table("care_plans")
                .select("*")
                .in_("consultation_id", consultation_ids)
                .execute()
            )
            care_plans = _rows(care_plans_response)
        messages_response = (
            supabase.table("patient_messages")
            .select("*")
            .eq("patient_id", patient_id)
            .order("timestamp", desc=False)
            .execute()
        )
        return (
            consultations,
            care_plans,
            _rows(messages_response),
        )

    consultations, care_plans, patient_messages = await asyncio.to_thread(_fetch_related)

    care_plan_map = {
        str(item.get("consultation_id")): _normalize_care_plan_row(item)
        for item in care_plans
        if item.get("consultation_id") is not None
    }
    messages_by_consultation: dict[str, list[dict[str, Any]]] = {}
    for message in patient_messages:
        normalized_message = _normalize_message_row(message)
        key = str(normalized_message.get("consultation_id") or "")
        messages_by_consultation.setdefault(key, []).append(normalized_message)

    enriched_consultations: list[dict[str, Any]] = []
    for consultation in consultations:
        consultation_id = str(consultation.get("id", ""))
        enriched_consultations.append(
            {
                **consultation,
                "care_plan": care_plan_map.get(
                    consultation_id,
                    _normalize_care_plan_row(
                        {"consultation_id": consultation.get("id")}
                    ),
                ),
                "chat_log": messages_by_consultation.get(consultation_id, []),
            }
        )

    past_doctors = list(
        dict.fromkeys(
            str(consultation.get("doctor_name", "") or "").strip()
            for consultation in consultations
            if str(consultation.get("doctor_name", "") or "").strip()
        )
    )

    return {
        "patient": patient,
        "consultations": enriched_consultations,
        "care_plans": care_plans,
        "patient_messages": [_normalize_message_row(message) for message in patient_messages],
        "past_doctors": past_doctors,
    }


async def save_consultation(
    mobile: str,
    name: str,
    doctor_name: str,
    transcript: str,
    symptoms: str,
    diagnosis: str,
    final_prescription: str,
    doctor_notes: str,
) -> int:
    patient = await _select_patient_by_mobile(mobile)

    if patient is None:
        patient_id = f"PT-{uuid.uuid4().hex[:8].upper()}"

        def _insert_patient() -> dict[str, Any]:
            response = (
                supabase.table("patients")
                .insert(
                    {
                        "patient_id": patient_id,
                        "name": name,
                        "mobile_number": mobile,
                    }
                )
                .execute()
            )
            return _row(response) or {}

        patient = await asyncio.to_thread(_insert_patient)
    else:
        patient_id = str(patient.get("patient_id", ""))

        def _update_patient() -> None:
            (
                supabase.table("patients")
                .update(
                    {
                        "name": name,
                        "mobile_number": mobile,
                    }
                )
                .eq("patient_id", patient_id)
                .execute()
            )

        await asyncio.to_thread(_update_patient)

    def _insert_consultation() -> int:
        response = (
            supabase.table("consultations")
            .insert(
                {
                    "patient_id": patient_id,
                    "doctor_name": doctor_name,
                    "transcript": transcript,
                    "symptoms": symptoms,
                    "diagnosis": diagnosis,
                    "final_prescription": final_prescription,
                    "doctor_notes": doctor_notes,
                }
            )
            .execute()
        )
        consultation = _row(response)
        if consultation is None or consultation.get("id") is None:
            raise RuntimeError("Supabase did not return the inserted consultation.")
        return int(consultation["id"])

    return await asyncio.to_thread(_insert_consultation)


async def save_care_plan(
    consultation_id: int,
    summary: str,
    ai_explanation: str,
    day_3_question: str,
) -> None:
    def _insert() -> None:
        consultation_response = (
            supabase.table("consultations")
            .select("id")
            .eq("id", consultation_id)
            .limit(1)
            .execute()
        )
        consultation = _row(consultation_response)
        if consultation is None:
            raise RuntimeError("Unable to find consultation for care plan save.")

        (
            supabase.table("care_plans")
            .insert(
                {
                    "consultation_id": consultation_id,
                    "patient_friendly_summary": summary,
                    "ai_patient_explanation": ai_explanation,
                    "day_3_question": day_3_question,
                    "requires_escalation": False,
                }
            )
            .execute()
        )

    await asyncio.to_thread(_insert)


async def save_patient_message(
    patient_id: str,
    consultation_id: int,
    message: str,
    image_base64: Optional[str],
) -> None:
    def _insert() -> None:
        (
            supabase.table("patient_messages")
            .insert(
                {
                    "patient_id": patient_id,
                    "consultation_id": consultation_id,
                    "message": message,
                    "image_base64": image_base64,
                    "requires_doctor_review": True,
                }
            )
            .execute()
        )

    await asyncio.to_thread(_insert)


async def get_pending_escalations(
    doctor_name: Optional[str] = None,
) -> list[dict[str, Any]]:
    def _fetch() -> list[dict[str, Any]]:
        query = (
            supabase.table("patient_messages")
            .select("*,patients(name),consultations(diagnosis,final_prescription,doctor_name)")
            .eq("requires_doctor_review", True)
        )
        if doctor_name:
            query = query.eq("consultations.doctor_name", doctor_name)
        response = query.order("timestamp", desc=True).execute()
        rows = _rows(response)
        escalations: list[dict[str, Any]] = []
        for row in rows:
            patient = row.get("patients") or {}
            consultation = row.get("consultations") or {}
            normalized_row = _normalize_message_row(row)
            escalations.append(
                {
                    "id": normalized_row.get("id"),
                    "patient_id": normalized_row.get("patient_id", ""),
                    "patient_name": patient.get("name", ""),
                    "message": normalized_row.get("message", ""),
                    "image_base64": normalized_row.get("image_base64", ""),
                    "doctor_reply": normalized_row.get("doctor_reply", ""),
                    "requires_doctor_review": normalized_row.get(
                        "requires_doctor_review", False
                    ),
                    "timestamp": normalized_row.get("timestamp", ""),
                    "diagnosis": consultation.get("diagnosis", "") or "",
                    "final_prescription": consultation.get("final_prescription", "") or "",
                    "doctor_name": consultation.get("doctor_name", "") or "",
                }
            )
        return escalations

    return await asyncio.to_thread(_fetch)


async def save_doctor_reply(message_id: int, reply: str) -> None:
    def _update() -> None:
        (
            supabase.table("patient_messages")
            .update(
                {
                    "doctor_reply": reply,
                    "requires_doctor_review": False,
                }
            )
            .eq("id", message_id)
            .execute()
        )

    await asyncio.to_thread(_update)


async def save_lab_report(
    patient_id: str,
    doctor_name: str,
    file_base64: str,
    mime_type: str,
    ai_analysis: str,
) -> int:
    def _insert() -> int:
        response = (
            supabase.table("lab_reports")
            .insert(
                {
                    "patient_id": patient_id,
                    "doctor_name": doctor_name,
                    "file_base64": file_base64,
                    "mime_type": mime_type,
                    "ai_analysis": ai_analysis,
                }
            )
            .execute()
        )
        lab_report = _row(response)
        if lab_report is None or lab_report.get("id") is None:
            raise RuntimeError("Supabase did not return the inserted lab report.")
        return int(lab_report["id"])

    return await asyncio.to_thread(_insert)


async def get_doctor_lab_reports(
    doctor_name: Optional[str] = None,
) -> list[dict[str, Any]]:
    def _fetch() -> list[dict[str, Any]]:
        query = supabase.table("lab_reports").select("*,patients(name,mobile_number)")
        if doctor_name:
            query = query.eq("doctor_name", doctor_name)
        response = query.order("timestamp", desc=True).execute()
        rows = _rows(response)
        reports: list[dict[str, Any]] = []
        for row in rows:
            patient = row.get("patients") or {}
            normalized = _normalize_lab_report_row(row)
            reports.append(
                {
                    **normalized,
                    "patient_name": str(patient.get("name", "") or ""),
                    "mobile_number": str(patient.get("mobile_number", "") or ""),
                }
            )
        return reports

    return await asyncio.to_thread(_fetch)


async def get_latest_consultation(patient_id: str) -> Optional[dict[str, Any]]:
    def _fetch() -> Optional[dict[str, Any]]:
        consultation_response = (
            supabase.table("consultations")
            .select("*")
            .eq("patient_id", patient_id)
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )
        consultation = _row(consultation_response)
        if consultation is None:
            return None

        consultation_id = consultation.get("id")
        care_plan_response = (
            supabase.table("care_plans")
            .select("*")
            .eq("consultation_id", consultation_id)
            .limit(1)
            .execute()
        )
        message_response = (
            supabase.table("patient_messages")
            .select("*")
            .eq("patient_id", patient_id)
            .not_.is_("doctor_reply", "null")
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )
        return {
            **consultation,
            "doctor_name": str(consultation.get("doctor_name", "") or ""),
            "diagnosis": str(consultation.get("diagnosis", "") or ""),
            "final_prescription": str(consultation.get("final_prescription", "") or ""),
            "timestamp": str(consultation.get("timestamp", "") or ""),
            "symptoms": str(consultation.get("symptoms", "") or ""),
            "transcript": str(consultation.get("transcript", "") or ""),
            "care_plan": _normalize_care_plan_row(_row(care_plan_response)),
            "doctor_reply": ((_row(message_response) or {}).get("doctor_reply", "") or ""),
        }

    return await asyncio.to_thread(_fetch)


async def get_latest_consultation_for_doctor(
    patient_id: str, doctor_name: str
) -> Optional[dict[str, Any]]:
    def _fetch() -> Optional[dict[str, Any]]:
        consultation_response = (
            supabase.table("consultations")
            .select("*")
            .eq("patient_id", patient_id)
            .eq("doctor_name", doctor_name)
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )
        consultation = _row(consultation_response)
        if consultation is None:
            return None

        consultation_id = consultation.get("id")
        care_plan_response = (
            supabase.table("care_plans")
            .select("*")
            .eq("consultation_id", consultation_id)
            .limit(1)
            .execute()
        )
        return {
            **consultation,
            "doctor_name": str(consultation.get("doctor_name", "") or ""),
            "diagnosis": str(consultation.get("diagnosis", "") or ""),
            "final_prescription": str(consultation.get("final_prescription", "") or ""),
            "timestamp": str(consultation.get("timestamp", "") or ""),
            "symptoms": str(consultation.get("symptoms", "") or ""),
            "transcript": str(consultation.get("transcript", "") or ""),
            "care_plan": _normalize_care_plan_row(_row(care_plan_response)),
        }

    return await asyncio.to_thread(_fetch)


async def get_patient_message_history(patient_id: str) -> list[dict[str, Any]]:
    def _fetch() -> list[dict[str, Any]]:
        response = (
            supabase.table("patient_messages")
            .select("*")
            .eq("patient_id", patient_id)
            .order("timestamp", desc=False)
            .execute()
        )
        return [_normalize_message_row(row) for row in _rows(response)]

    return await asyncio.to_thread(_fetch)


async def get_patient_history(patient_id: str) -> list[dict[str, Any]]:
    def _fetch() -> list[dict[str, Any]]:
        response = (
            supabase.table("consultations")
            .select("*")
            .eq("patient_id", patient_id)
            .order("timestamp", desc=True)
            .execute()
        )
        return _rows(response)

    consultations = await asyncio.to_thread(_fetch)
    consultation_ids = [
        item.get("id") for item in consultations if item.get("id") is not None
    ]

    def _fetch_care_plans() -> list[dict[str, Any]]:
        if not consultation_ids:
            return []
        response = (
            supabase.table("care_plans")
            .select("*")
            .in_("consultation_id", consultation_ids)
            .execute()
        )
        return _rows(response)

    def _fetch_messages() -> list[dict[str, Any]]:
        response = (
            supabase.table("patient_messages")
            .select("*")
            .eq("patient_id", patient_id)
            .order("timestamp", desc=False)
            .execute()
        )
        return _rows(response)

    care_plans, messages = await asyncio.gather(
        asyncio.to_thread(_fetch_care_plans),
        asyncio.to_thread(_fetch_messages),
    )

    care_plan_map = {
        str(item.get("consultation_id")): _normalize_care_plan_row(item)
        for item in care_plans
        if item.get("consultation_id") is not None
    }
    latest_reply = next(
        (
            str(message.get("doctor_reply", "") or "")
            for message in reversed(messages)
            if str(message.get("doctor_reply", "") or "").strip()
        ),
        "",
    )

    return [
        {
            **consultation,
            "doctor_name": str(consultation.get("doctor_name", "") or ""),
            "diagnosis": str(consultation.get("diagnosis", "") or ""),
            "final_prescription": str(consultation.get("final_prescription", "") or ""),
            "timestamp": str(consultation.get("timestamp", "") or ""),
            "symptoms": str(consultation.get("symptoms", "") or ""),
            "transcript": str(consultation.get("transcript", "") or ""),
            "care_plan": care_plan_map.get(
                str(consultation.get("id")),
                _normalize_care_plan_row({"consultation_id": consultation.get("id")}),
            ),
            "doctor_reply": latest_reply,
        }
        for consultation in consultations
    ]
