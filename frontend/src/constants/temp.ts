import type { HrDecisionHistoryItem } from "@/apis/candidateDecision";
import type { EvaluationRead } from "@/types/candidateStage";

export const TEMP_TECHNICAL_ROUND_RESPONSE: EvaluationRead = {
    "id": "019e923e-2ae7-77a5-8f43-777be4e968df",
    "interview_id": null,
    "transcript_id": null,
    "candidate_stage_id": "019e91b3-fe14-709c-bf43-800739c2908b",
    "version": 1,
    "overall_score": 2.6,
    "result": "fail",
    "evaluation_data": {
        "JD Skills": [
            {
                "Debug approach": {
                    "score": 3,
                    "evidence": [],
                    "reasoning": "The current implementation uses FAISS for similarity search. The time complexity for retrieval is approximately O(log N) for indexed search, which is efficient. However, the system is synchronous; the Streamlit UI blocks during LLM generation and voice synthesis, leading to a poor user experience. To optimize, the candidate should implement asynchronous processing (async/await) and a task queue for voice generation.",
                    "confidence": 0.9
                }
            },
            {
                "Logical thinking": {
                    "score": 2,
                    "evidence": [],
                    "reasoning": "The architecture is a simple monolithic script structure. It lacks the requested API layer (FastAPI) and persistence layer (SQLAlchemy).",
                    "confidence": 0.9
                }
            },
            {
                "Code structure clarity": {
                    "score": 3,
                    "evidence": [],
                    "reasoning": "The code is modular (separate files for voice, rag, and digital twin), but lacks type hinting and follows a script-like structure rather than an enterprise application structure.",
                    "confidence": 0.9
                }
            },
            {
                "Problem-solving ability": {
                    "score": 2,
                    "evidence": [],
                    "reasoning": "The logic for the RAG pipeline is fundamentally correct for an MVP, but there is no error handling for API failures or empty scraping results.",
                    "confidence": 0.9
                }
            },
            {
                "Implementation accuracy": {
                    "score": 2,
                    "evidence": [],
                    "reasoning": "The logic for the RAG pipeline is fundamentally correct for an MVP, but there is no error handling for API failures or empty scraping results.",
                    "confidence": 0.9
                }
            },
            {
                "Security compliance": {
                    "score": 3,
                    "evidence": [],
                    "reasoning": "The candidate correctly uses a .env file for the API key, avoiding hardcoded secrets in the source code.",
                    "confidence": 0.9
                }
            },
            {
                "Documentation quality": {
                    "score": 3,
                    "evidence": [],
                    "reasoning": "The README is clear and provides a good setup guide, but there is no technical documentation regarding the system design or API specifications.",
                    "confidence": 0.9
                }
            },
            {
                "overall_summary": "REJECT (2.5/5.0) | The candidate satisfies the Python and LangChain requirements. However, the JD specifically asks for FastAPI and SQLAlchemy. The current implementation uses Streamlit for the UI, which is suitable for a demo but does not demonstrate the ability to build scalable backend APIs or manage relational data via an ORM."
            },
            {
                "strengths": [
                    "Strong use of LangChain for RAG orchestration",
                    "Proficient Python implementation for a prototype"
                ]
            },
            {
                "weaknesses": [
                    "Complete absence of FastAPI",
                    "Complete absence of SQLAlchemy or any relational database management"
                ]
            },
            {
                "suggested_followups": [
                    "How would you migrate this Streamlit application into a FastAPI backend with a React frontend?",
                    "How would you use SQLAlchemy to persist user 'Digital Twin' profiles and chat history across sessions?",
                    "Can you walk me through the High-Level Design (HLD) of this system if you were to scale it to 10,000 users?",
                    "How would you implement Chain of Thought prompting to improve the medical accuracy of the chatbot's reasoning?"
                ]
            }
        ],
        "Task Skills": [
            {
                "Debug approach": {
                    "score": 3,
                    "evidence": [],
                    "reasoning": "The vector search using FAISS is O(log N), which is performant for the small dataset provided. However, the data pipeline is manual (running scripts sequentially). An optimized version would use a scheduled ETL pipeline and a hosted vector database for O(1) or O(log N) retrieval across distributed nodes.",
                    "confidence": 0.9
                }
            },
            {
                "Logical thinking": {
                    "score": 2,
                    "evidence": [],
                    "reasoning": "The architecture is too simplistic. It lacks caching strategies and a formal data flow design, relying on local file storage (medical_kb.txt).",
                    "confidence": 0.9
                }
            },
            {
                "Code structure clarity": {
                    "score": 3,
                    "evidence": [],
                    "reasoning": "Separation of concerns is present (scraping is separate from retrieval), which is a positive sign for a junior-level project.",
                    "confidence": 0.9
                }
            },
            {
                "Problem-solving ability": {
                    "score": 3,
                    "evidence": [],
                    "reasoning": "The RAG flow (Retrieve -> Augment -> Generate) is implemented correctly according to standard AI/ML fundamentals.",
                    "confidence": 0.9
                }
            },
            {
                "Implementation accuracy": {
                    "score": 3,
                    "evidence": [],
                    "reasoning": "The RAG flow (Retrieve -> Augment -> Generate) is implemented correctly according to standard AI/ML fundamentals.",
                    "confidence": 0.9
                }
            },
            {
                "Security compliance": {
                    "score": 3,
                    "evidence": [],
                    "reasoning": "Basic security is handled via .env, but there is no input validation on the user-provided medical history, which could lead to prompt injection.",
                    "confidence": 0.9
                }
            },
            {
                "Documentation quality": {
                    "score": 2,
                    "evidence": [],
                    "reasoning": "The README is sufficient for installation, but the project fails all 'Document Skills' requirements (no HLD, LLD, or Data Flow Diagrams).",
                    "confidence": 0.9
                }
            },
            {
                "overall_summary": "REJECT (2.7/5.0) | The candidate hits the technical marks for RAG, Vector DBs, and Web Scraping. However, the 'Project Required Document Skills' are almost entirely ignored. There are no diagrams, no requirement docs, and no testing suites. The project is a functional prototype but not a professionally engineered system."
            },
            {
                "strengths": [
                    "Successful implementation of RAG pipeline",
                    "Integration of Vector Database (FAISS)",
                    "Implementation of a custom data pipeline (Scraping -> Embedding -> Vector Store)",
                    "Creative use of a 'Digital Twin' concept for personalization"
                ]
            },
            {
                "weaknesses": [
                    "Missing all design documentation (HLD, LLD, Diagrams)",
                    "No unit testing implemented",
                    "No evidence of Chain of Thought prompting or advanced LLM techniques",
                    "No use of open-source models (Llama/Ollama) - relies solely on OpenAI"
                ]
            },
            {
                "suggested_followups": [
                    "How would you migrate this Streamlit application into a FastAPI backend with a React frontend?",
                    "How would you use SQLAlchemy to persist user 'Digital Twin' profiles and chat history across sessions?",
                    "Can you walk me through the High-Level Design (HLD) of this system if you were to scale it to 10,000 users?",
                    "How would you implement Chain of Thought prompting to improve the medical accuracy of the chatbot's reasoning?"
                ]
            }
        ]
    },
    "sim_jd_resume": null,
    "sim_jd_transcript": null,
    "sim_resume_transcript": null,
    "created_at": "2026-06-04T10:46:17.849608Z",
    "highlights": {
        "strengths": [
            {
                "JD Alignment": [
                    "Strong use of LangChain for RAG orchestration",
                    "Proficient Python implementation for a prototype"
                ]
            },
            {
                "Project Requirements": [
                    "Successful implementation of RAG pipeline",
                    "Integration of Vector Database (FAISS)",
                    "Implementation of a custom data pipeline (Scraping -> Embedding -> Vector Store)",
                    "Creative use of a 'Digital Twin' concept for personalization"
                ]
            }
        ],
        "weaknesses": [
            {
                "JD Alignment": [
                    "Complete absence of FastAPI",
                    "Complete absence of SQLAlchemy or any relational database management"
                ]
            },
            {
                "Project Requirements": [
                    "Missing all design documentation (HLD, LLD, Diagrams)",
                    "No unit testing implemented",
                    "No evidence of Chain of Thought prompting or advanced LLM techniques",
                    "No use of open-source models (Llama/Ollama) - relies solely on OpenAI"
                ]
            }
        ],
        "suggested_followups": [
            "How would you migrate this Streamlit application into a FastAPI backend with a React frontend?",
            "How would you use SQLAlchemy to persist user 'Digital Twin' profiles and chat history across sessions?",
            "Can you walk me through the High-Level Design (HLD) of this system if you were to scale it to 10,000 users?",
            "How would you implement Chain of Thought prompting to improve the medical accuracy of the chatbot's reasoning?"
        ],
        "overall_summary": [
            {
                "JD Alignment": "REJECT (2.5/5.0) | The candidate satisfies the Python and LangChain requirements. However, the JD specifically asks for FastAPI and SQLAlchemy. The current implementation uses Streamlit for the UI, which is suitable for a demo but does not demonstrate the ability to build scalable backend APIs or manage relational data via an ORM."
            },
            {
                "Project Requirements": "REJECT (2.7/5.0) | The candidate hits the technical marks for RAG, Vector DBs, and Web Scraping. However, the 'Project Required Document Skills' are almost entirely ignored. There are no diagrams, no requirement docs, and no testing suites. The project is a functional prototype but not a professionally engineered system."
            },
            {
                "Architecture": "The architecture is a basic prototype. It lacks the robustness of a production system, specifically missing an API layer, a persistent relational database, and asynchronous task handling."
            },
            {
                "Code Quality": "The code is clean and readable but lacks the rigor of senior engineering (no type hints, no comprehensive error handling, no unit tests)."
            },
            {
                "Security Risks": "Potential for Prompt Injection via the 'Medical History' text area in the Digital Twin profile."
            }
        ],
        "recommendation": "JD Alignment: REJECT (2.5/5.0) | Project Alignment: REJECT (2.7/5.0)"
    }
}


export const TEMP_TECHNICAL_ROUND_HR_DECISION: HrDecisionHistoryItem[] = [
    {
        "id": "019eac06-b64c-77c0-b966-19b96f229aa5",
        "candidate_id": "019e024e-e259-7228-921c-c9d0062fd26d",
        "stage_config_id": "019e91b3-f97d-7084-996e-a78103ee7ed4",
        "stage_name": "Technical Practical Round",
        "job_id": "019e91b3-f764-7686-a287-cdbbe9fb0dbb",
        "user_id": "019d5e27-c255-7197-9965-82a6f45ae906",
        "decision": "pass",
        "notes": "lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm lgtm ",
        "score": 4,
        "decided_at": "2026-06-09T10:56:20.840795Z"
    }]


