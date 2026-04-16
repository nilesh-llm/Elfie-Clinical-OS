# 🏥 Elfie Clinical OS | End-to-End Clinical Intelligence Stack

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Qwen](https://img.shields.io/badge/Qwen_Max-5C5CFF?style=for-the-badge&logo=alibabacloud&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

**Built for the Qwen AI Build Day 2026 — Elfie Healthcare Track.**

The Elfie Clinical OS is a multimodal, closed-loop Electronic Medical Record (EMR) and Telemedicine platform. It bridges the gap between clinical documentation and patient adherence. Rather than just acting as a "medical scribe" that types what a doctor says, this OS acts as an active **Clinical Co-Pilot**, catching medical errors in real-time, translating medical jargon into patient-friendly care plans, and automating post-consultation follow-ups.

## ✨ Key Features

*   🎙️ **Multilingual Medical Scribe:** Captures live consultation audio and uses **Qwen-Audio/Max** to extract structured clinical entities (Chief Complaint, Symptoms, Diagnosis, Medications) with built-in confidence scoring. Natively supports English, Vietnamese, French, and Arabic.
*   🚨 **Clinical Decision Support (CDS):** Cross-references the doctor's diagnosis and prescriptions against extracted symptoms to autonomously flag critical missed red flags, contradictions, or adverse drug interactions before the record is saved.
*   📱 **Patient Care Portal & Lab Analyzer:** A secure, mobile-first patient dashboard (authenticated via mobile number). Patients can view their care plan without medical jargon, upload PDF Lab Reports/Images for **Qwen-VL** to simplify into patient-friendly summaries, and send updates to the doctor.
*   💾 **Longitudinal Patient Memory:** Powered by a relational Supabase (PostgreSQL) database, allowing doctors to use a "Universal Search" to pull up a patient's complete timeline, preventing fragmented care across different clinics.

---

## 🏗️ Technical Architecture

*   **Frontend:** Next.js 14, Tailwind CSS, Lucide Icons (Two distinct UX flows: Doctor Desktop Dashboard & Patient Mobile Simulator).
*   **Backend:** FastAPI (Python) for high-performance, asynchronous AI and database orchestration.
*   **AI Engine:** Alibaba Cloud's **Qwen-Max** (Clinical NLP & Reasoning) and **Qwen-VL-Max** (Multimodal Image/Lab Report analysis) accessed via the DashScope OpenAI-compatible API.
*   **Database:** Supabase (PostgreSQL) handling relational data between `patients`, `consultations`, `care_plans`, and `patient_messages`.

---

## 🚀 Installation & Setup

### Prerequisites
*   Node.js (v18+)
*   Python (3.9+)
*   An Alibaba Cloud DashScope API Key
*   A Supabase Project (URL and Anon Key)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/Elfie-Clinical-OS.git
cd Elfie-Clinical-OS
2. Backend Setup (FastAPI)
Open a terminal in the root directory:
code
Bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
Create a .env file inside the backend folder:
code
Env
DASHSCOPE_API_KEY="sk-your-alibaba-dashscope-key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-anon-public-key"
Start the backend server:
code
Bash
uvicorn main:app --reload --port 8000
3. Frontend Setup (Next.js)
Open a second terminal window in the root directory:
code
Bash
cd frontend
npm install
npm run dev

🎮 Running the Demo
To evaluate the full closed-loop architecture, follow this exact workflow:
The Doctor Intake: Open http://localhost:3000. Select your language. Hit "Record Live" and describe a patient with severe chest pain.
The Safety Trap: Add a Doctor's Note prescribing "Omeprazole for Acid Reflux". Hit Process. Watch the Qwen CDS Engine throw a massive Red Flag alert warning the doctor of a misdiagnosed cardiac event.
The Handoff: Approve and save the record. Note the generated Patient ID and Mobile Number.
The Patient App: Open http://localhost:3000/patient. Log in securely.
The Lab Analyzer: Upload a sample Lab Report PDF or Image. Watch Qwen-VL break down the medical jargon into a comforting, patient-friendly summary, and route it securely to the Doctor's inbox.

📜 License
Built for the 2026 Qwen AI Build Day. Open-sourced under the MIT License.
