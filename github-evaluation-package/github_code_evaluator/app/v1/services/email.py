import logging
import smtplib
from email.message import EmailMessage
import asyncio
from github_code_evaluator.app.v1.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Email Service supporting both live SMTP dispatch and mock logging fallback."""

    @staticmethod
    def _send_smtp_email_sync(
        recipient: str,
        subject: str,
        body: str,
    ) -> bool:
        """Synchronous helper running in a background thread to send SMTP email."""
        if not settings.SMTP_HOST:
            return False

        msg = EmailMessage()
        msg.set_content(body)
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = recipient

        try:
            # Connect to SMTP server
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_PORT == 587:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD.get_secret_value())
                server.send_message(msg)
            logger.info(f"Successfully sent SMTP email to {recipient}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {recipient} via SMTP: {e}")
            return False

    @staticmethod
    async def send_email(
        recipient: str,
        subject: str,
        body: str,
    ) -> bool:
        """Send email. If SMTP_HOST is configured, uses live SMTP; otherwise falls back to mock logging."""
        if settings.SMTP_HOST:
            logger.info(f"Dispatching live SMTP email to {recipient} via {settings.SMTP_HOST}")
            return await asyncio.to_thread(
                EmailService._send_smtp_email_sync, recipient, subject, body
            )
        else:
            logger.info(
                f"\n=== MOCK EMAIL DISPATCH (Configure SMTP_HOST in .env for live mail) ===\n"
                f"To: {recipient}\n"
                f"Subject: {subject}\n"
                f"Body:\n{body}\n"
                f"========================================================================"
            )
            return True

    @staticmethod
    async def notify_access_failure(
        candidate_email: str,
        recruiter_email: str,
        github_url: str,
        grace_period_hours: int = 48,
    ) -> None:
        """Notify candidate and HR about repository accessibility/cloning issue."""
        candidate_subject = "Action Required: Provide access to your GitHub Repository"
        candidate_body = (
            f"Hello,\n\n"
            f"Our system could not access or clone your repository: {github_url}.\n"
            f"Please verify that the repository is public and accessible, or grant access permissions.\n"
            f"You have {grace_period_hours} hours to resolve this issue before this evaluation link expires.\n\n"
            f"Best regards,\nAIRA Talent"
        )
        
        recruiter_subject = f"Alert: Repository Access Failure - Candidate Repo {github_url}"
        recruiter_body = (
            f"Hello HR/Recruiter,\n\n"
            f"The evaluation process for candidate repository {github_url} failed because the repository is inaccessible.\n"
            f"The candidate has been notified and granted a {grace_period_hours}-hour grace period to resolve the issue.\n\n"
            f"Best regards,\nAIRA Talent"
        )

        await EmailService.send_email(candidate_email, candidate_subject, candidate_body)
        await asyncio.sleep(1.5)
        await EmailService.send_email(recruiter_email, recruiter_subject, recruiter_body)

    @staticmethod
    async def notify_evaluation_failure(
        candidate_email: str,
        recruiter_email: str,
        github_url: str,
        reason: str,
    ) -> None:
        """Notify candidate and HR about system evaluation failure after exhausts (Disabled as per user request)."""
        logger.info(f"System evaluation failure email suppressed for {github_url}.")
        pass

    @staticmethod
    async def notify_evaluation_result(
        candidate_email: str,
        recruiter_email: str,
        github_url: str,
        overall_score: float,
        recommendation: str,
        interview_questions: list[str] = None,
    ) -> None:
        """Notify recruiter (HR) of the candidate evaluation results."""
        subject = f"Technical Evaluation Complete: {recommendation} ({overall_score}/5.0)"
        
        questions_text = ""
        if interview_questions:
            questions_text = "\n\nSuggested Interview Questions:\n" + "\n".join(
                f"- {q}" for q in interview_questions
            )

        hr_body = (
            f"Hello HR / Hiring Team,\n\n"
            f"The candidate technical evaluation for repository {github_url} has completed successfully.\n"
            f"Overall Score: {overall_score}/5.0.\n"
            f"Recommendation: {recommendation}{questions_text}\n\n"
            f"Best regards,\nAIRA Talent"
        )
        await EmailService.send_email(recruiter_email, subject, hr_body)



email_service = EmailService()

