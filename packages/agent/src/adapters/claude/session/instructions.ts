const BRANCH_NAMING = `
# Branch Naming

When working in a detached HEAD state, create a descriptive branch name based on the work being done before committing. Do this automatically without asking the user.
`;

const PLAN_MODE = `
# Plan Mode

Only enter plan mode (EnterPlanMode) when the user is requesting a significant change in approach or direction mid-task. Do NOT enter plan mode for:
- Confirmations or approvals ("yes", "looks good", "continue", "go ahead")
- Minor clarifications or small adjustments
- Answers to questions you asked (unless you are still in the initial planning phase and have not yet started executing)
- Feedback that does not require replanning

When in doubt, continue executing and incorporate the feedback inline.
`;

const MEMORY_SYSTEM = `
# Memory System

You have access to a persistent memory system via MCP tools. Use it to build long-term knowledge across task runs.

## When to save memories (save_memory tool)
- User preferences for how work should be done
- Important facts about the codebase, APIs, or infrastructure you discover
- Architectural decisions or conventions
- Gotchas, pitfalls, or non-obvious behaviors
- Project goals or context shared by the user

## When to recall memories (recall_memory tool)
- When you need context about the codebase or project
- When you encounter something that feels like it was discussed before
- At the start of complex tasks, search for relevant prior knowledge

## When to forget memories (forget_memory tool)
- When you discover a previously stored memory is wrong or outdated

Do NOT use the file-based memory system (MEMORY.md, mkdir memory/). Always use the MCP memory tools instead.
`;

export const APPENDED_INSTRUCTIONS = BRANCH_NAMING + PLAN_MODE + MEMORY_SYSTEM;
