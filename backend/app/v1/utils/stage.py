import uuid
from typing import Any

def get_stage_required_inputs(stage_config: dict | None, template_name: str | None) -> list[str]:
    """
    Resolves the required inputs for a stage.
    Supports a dynamic 'required_inputs' list.
    If not specified, falls back to default values based on the template name
    for backward compatibility.
    """
    if isinstance(stage_config, dict) and "required_inputs" in stage_config:
        inputs = stage_config["required_inputs"]
        # Only return the inputs if it is a list and has at least one element.
        # Otherwise, fall back to default values.
        if isinstance(inputs, list) and len(inputs) > 0:
            return [str(i) for i in inputs]
            
    # Fallback rules based on template name
    if template_name == "Technical Practical Round":
        return ["github", "question"]
    elif template_name == "Resume Screening":
        return ["resume"]
    else:
        return ["transcript"]



def get_question_round_filter(job_stage_config_cls, stage_template_cls):
    """
    Returns the SQLAlchemy filter to check if a stage requires 'question'.
    Falls back to template name == 'Technical Practical Round' if required_inputs is absent.
    """
    from sqlalchemy import or_, and_, func
    
    config_has_question = job_stage_config_cls.config["required_inputs"].contains(["question"])
    template_has_question = stage_template_cls.default_config["required_inputs"].contains(["question"])
    
    config_missing_or_empty = or_(
        job_stage_config_cls.config.is_(None), 
        ~job_stage_config_cls.config.has_key("required_inputs"),
        func.jsonb_array_length(job_stage_config_cls.config["required_inputs"]) == 0
    )
    
    template_missing_or_empty = or_(
        stage_template_cls.default_config.is_(None), 
        ~stage_template_cls.default_config.has_key("required_inputs"),
        func.jsonb_array_length(stage_template_cls.default_config["required_inputs"]) == 0
    )
    
    required_inputs_absent_and_name_matches = and_(
        config_missing_or_empty,
        template_missing_or_empty,
        stage_template_cls.name == "Technical Practical Round"
    )
    
    return or_(
        config_has_question,
        and_(
            config_missing_or_empty,
            template_has_question
        ),
        required_inputs_absent_and_name_matches
    )

