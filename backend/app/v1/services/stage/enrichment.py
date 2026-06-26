import uuid
from typing import Any, Dict, List, TypeVar, Union
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.criteria import Criterion
from app.v1.db.models.stage_templates import StageTemplate
from app.v1.db.models.job_stage_configs import JobStageConfig

T = TypeVar("T", StageTemplate, JobStageConfig)

async def enrich_stage_configs(
    db: AsyncSession, 
    items: Union[T, List[T]]
) -> Union[T, List[T]]:
    """
    Enriches the configuration of StageTemplate or JobStageConfig objects.
    
    Converts 'criteria_ids' to 'evaluation_criteria' with full ID and name objects.
    """
    if not items:
        return items

    is_list = isinstance(items, list)
    objects = items if is_list else [items]
    
    # 1. Collect all criteria IDs and potential names that need fetching
    all_criteria_ids = set()
    all_criteria_names = set()
    for obj in objects:
        config = getattr(obj, "default_config", None) or getattr(obj, "config", None)
        if isinstance(config, dict) and "criteria_ids" in config:
            ids = config.get("criteria_ids", [])
            for cid in ids:
                try:
                    if isinstance(cid, str):
                        try:
                            all_criteria_ids.add(uuid.UUID(cid))
                        except ValueError:
                            all_criteria_names.add(cid.lower())
                    elif isinstance(cid, uuid.UUID):
                        all_criteria_ids.add(cid)
                except ValueError:
                    continue

    if not all_criteria_ids and not all_criteria_names:
        return items

    # 2. Fetch all criteria (IDs and names) to build lookups
    result = await db.execute(
        select(Criterion.id, Criterion.name)
    )
    rows = result.all()
    criteria_map_by_id = {str(row.id): row.name for row in rows}
    criteria_map_by_name = {row.name.lower(): str(row.id) for row in rows}

    # 3. Enrich the configurations
    for obj in objects:
        attr_name = "default_config" if hasattr(obj, "default_config") else "config"
        config = getattr(obj, attr_name)
        
        if isinstance(config, dict):
            new_config = dict(config)
            has_changes = False
            
            # Case 1: Resolve criteria_ids to evaluation_criteria
            if "criteria_ids" in new_config:
                ids = new_config.pop("criteria_ids", [])
                evaluation_criteria = []
                for cid in ids:
                    cid_str = str(cid)
                    # Try lookup by UUID first
                    if cid_str in criteria_map_by_id:
                        evaluation_criteria.append({"id": cid_str, "name": criteria_map_by_id[cid_str]})
                    # Try lookup by name
                    elif cid_str.lower() in criteria_map_by_name:
                        matched_id = criteria_map_by_name[cid_str.lower()]
                        evaluation_criteria.append({"id": matched_id, "name": cid_str})
                    else:
                        evaluation_criteria.append({"id": None, "name": cid_str})
                
                new_config["evaluation_criteria"] = evaluation_criteria
                has_changes = True
            
            # Case 2: Normalize existing evaluation_criteria if they are strings
            # Now we also try to find their IDs by name match
            elif "evaluation_criteria" in new_config:
                current_criteria = new_config.get("evaluation_criteria", [])
                if isinstance(current_criteria, list) and len(current_criteria) > 0:
                    if isinstance(current_criteria[0], str):
                        normalized = []
                        for item in current_criteria:
                            if isinstance(item, str):
                                # Lookup by name (case-insensitive)
                                matched_id = criteria_map_by_name.get(item.lower())
                                normalized.append({"id": matched_id, "name": item})
                            else:
                                normalized.append(item)
                        new_config["evaluation_criteria"] = normalized
                        has_changes = True
            
            if has_changes:
                setattr(obj, attr_name, new_config)

    return items if is_list else objects[0]

def prepare_config_for_save(config: Any) -> Dict[str, Any] | None:
    """
    Prepares the configuration dictionary for saving to the database.
    
    Converts 'evaluation_criteria' (list of objects) back to 'criteria_ids' (list of strings).
    """
    if hasattr(config, "model_dump"):
        config = config.model_dump()
    elif hasattr(config, "dict"):
        config = config.dict()

    if not isinstance(config, dict):
        return config
    
    new_config = dict(config)
    if "evaluation_criteria" in new_config:
        eval_criteria = new_config.pop("evaluation_criteria", [])
        if isinstance(eval_criteria, list):
            criteria_ids = []
            for item in eval_criteria:
                if isinstance(item, dict) and "id" in item:
                    criteria_ids.append(item["id"])
                elif isinstance(item, str):
                    criteria_ids.append(item)
            new_config["criteria_ids"] = criteria_ids
            
    return new_config
