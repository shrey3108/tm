from fastapi import APIRouter
from app.v1.routes.task_papers_predefined import router as predefined_router
from app.v1.routes.task_papers_assigned import router as assigned_router
from app.v1.routes.task_papers_email import router as email_router
from app.v1.routes.task_papers_preview import router as preview_router

router = APIRouter()
router.routes.extend(preview_router.routes)
router.routes.extend(predefined_router.routes)
router.routes.extend(assigned_router.routes)
router.routes.extend(email_router.routes)
