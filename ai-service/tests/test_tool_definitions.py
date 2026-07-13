"""Structural tests for the OpenAI tool/function definitions.

These run with no database and no network access — they only check
that the schema handed to OpenAI is well-formed and stays in sync
with the registered tool handlers.
"""
from app.tools.definitions import TOOL_DEFINITIONS
from app.tools.executor import TOOL_HANDLERS


def test_every_definition_has_required_openai_fields() -> None:
    for definition in TOOL_DEFINITIONS:
        assert definition["type"] == "function"
        function = definition["function"]
        assert isinstance(function["name"], str) and function["name"]
        assert isinstance(function["description"], str) and function["description"]
        parameters = function["parameters"]
        assert parameters["type"] == "object"
        assert "properties" in parameters


def test_tool_names_are_unique() -> None:
    names = [d["function"]["name"] for d in TOOL_DEFINITIONS]
    assert len(names) == len(set(names))


def test_every_definition_has_a_registered_handler() -> None:
    definition_names = {d["function"]["name"] for d in TOOL_DEFINITIONS}
    handler_names = set(TOOL_HANDLERS.keys())
    assert definition_names == handler_names


def test_required_parameters_are_declared_in_properties() -> None:
    for definition in TOOL_DEFINITIONS:
        parameters = definition["function"]["parameters"]
        required = parameters.get("required", [])
        for field_name in required:
            assert field_name in parameters["properties"], (
                f"{definition['function']['name']} lists {field_name!r} as "
                "required but does not define it in properties"
            )


def test_create_task_requires_only_title() -> None:
    create_task = next(
        d for d in TOOL_DEFINITIONS if d["function"]["name"] == "create_task"
    )
    assert create_task["function"]["parameters"]["required"] == ["title"]


def test_create_reminder_allows_task_or_meeting_link() -> None:
    create_reminder = next(
        d for d in TOOL_DEFINITIONS if d["function"]["name"] == "create_reminder"
    )
    properties = create_reminder["function"]["parameters"]["properties"]
    assert "task_id" in properties
    assert "meeting_id" in properties
