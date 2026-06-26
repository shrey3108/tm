# Stage & Task Paper API Guide (for Frontend Team)

Base URL: `/api/v1`
All endpoints require auth (Bearer token). Permission needed per endpoint is noted.

---

## Real Stage Templates (already created in your system)

These templates already exist in the DB. Use their `id` as `template_id` when adding stages to a job.

### 1. Coding Test Round
```json
{
  "name": "Coding Test Round",
  "is_default": false,
  "default_order": null,
  "description": "Round evaluating candidate using questions only.",
  "config": {
    "required_inputs": ["question"],
    "evaluation_criteria": [
      { "id": "019eeb42-ee02-709b-9af6-9bd2407f665e", "name": "Tech Stack" },
      { "id": "019eeb42-edf5-7c7f-8514-67ab8a762314", "name": "Communication" }
    ],
    "is_panel_interview": false
  },
  "id": "019efe90-d7ab-747b-ac53-d9974e1f9a0d",
  "created_at": "2026-06-25T11:36:05.680913Z"
}
```
👉 `template_id` = `019efe90-d7ab-747b-ac53-d9974e1f9a0d`
👉 Inputs: `question` → use this round for **task paper assignment**

---

### 2. HR Screening Round1
```json
{
  "name": "HR Screening Round1",
  "is_default": false,
  "default_order": null,
  "description": "HR call evaluation based on audio/video interview transcript.",
  "config": {
    "required_inputs": ["transcript"],
    "evaluation_criteria": [
      { "id": "019eeb42-edfc-74a9-86c3-6c74ec9e3ffa", "name": "Cultural Fit" },
      { "id": "019eeb42-edf5-7c7f-8514-67ab8a762314", "name": "Communication" },
      { "id": "019eeb42-ee04-7f5f-93cb-bd0293f5ca88", "name": "Salary Alignment" }
    ],
    "is_panel_interview": false
  },
  "id": "019efe91-9b5b-73c1-b19e-c2131a23d87c",
  "created_at": "2026-06-25T11:36:55.867599Z"
}
```
👉 `template_id` = `019efe91-9b5b-73c1-b19e-c2131a23d87c`
👉 Inputs: `transcript` → use this round for **transcript upload** (NOT task papers)

---

### 3. Technical Practical Round
```json
{
  "name": "Techvnical Practical Round",
  "is_default": false,
  "default_order": null,
  "description": "Practical coding round requiring GitHub code submission and answering question sheet.",
  "config": {
    "required_inputs": ["question", "github"],
    "evaluation_criteria": [
      { "id": "019eeb42-ee02-709b-9af6-9bd2407f665e", "name": "Tech Stack" },
      { "id": "019eeb42-edff-741f-932d-4ca61616381f", "name": "Profile Understanding" }
    ],
    "is_panel_interview": false
  },
  "id": "019efe91-3fef-706b-a2d9-c8662e948749",
  "created_at": "2026-06-25T11:36:32.475349Z"
}
```
👉 `template_id` = `019efe91-3fef-706b-a2d9-c8662e948749`
👉 Inputs: `question` + `github` → use this round for **task paper assignment + GitHub evaluation**

---

### Quick Template ID Reference
| Template | template_id | required_inputs | Use for |
|---|---|---|---|
| Coding Test Round | `019efe90-d7ab-747b-ac53-d9974e1f9a0d` | `question` | Task paper |
| HR Screening Round1 | `019efe91-9b5b-73c1-b19e-c2131a23d87c` | `transcript` | Transcript upload |
| Technical Practical Round | `019efe91-3fef-706b-a2d9-c8662e948749` | `question`, `github` | Task paper + GitHub |

---

## Task Paper Assign Example (custom mode, job-level)

```bash
POST /api/v1/task-papers/assign
{
  "job_id": "019f025a-6b23-7a8e-89ed-f8d787fc6e78",
  "job_stage_id": "019f025a-6dc3-77f8-83bc-f92d6ac41ff4",
  "mode": "custom",
  "questions": ["Q1", "Q2"],
  "project_task": "Build something"
}
```
