---
name: write-spec
description: Synthesize the current conversation into a Specification, filling any implementation/testing-decision gaps with a short targeted interview, then publish it to the project issue tracker.
disable-model-invocation: true
---

This skill turns the current conversation and codebase understanding into a Specification. Domain vocabulary (`CONTEXT.md`) and architecture decisions (`docs/adr/`) are settled ground truth — never re-litigate them here.

The Specification's Implementation Decisions, Testing Decisions, and User Stories sections are this skill's own responsibility to originate, not something to inherit from an earlier interview. Where the conversation and codebase already answer a section, synthesize from that. Where they don't, ask the user directly, one question at a time, leading with a recommendation and a one-line reason — the same discipline as `/design-tree`. Never invent a decision to fill a gap.

The issue tracker and triage label vocabulary should have been provided to you — stop here if these are not available, and flag the user.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary (`CONTEXT.md`) throughout the Specification, and respect any ADRs under `docs/adr` in the areas you're touching. If a question is answerable by reading the code, read it instead of asking.

2. Sketch out the seams at which you're going to test the feature. Existing seams should be preferred to new ones. Use the highest seam possible. If new seams are needed, propose them at the highest point you can. The fewer seams across the codebase, the better - the ideal number is one.

Confirm these seams with the user. Actively look for opportunities to extract deep modules that can be tested in isolation.

A deep module (as apposed to a shallow module) is one which encapsulates a lot of functionality in a simple, testable interface that rarely changes.

3. Walk the Specification template section by section. For Implementation Decisions, Testing Decisions, and User Stories specifically: if the conversation/codebase already settles it, write it in; if not, ask the user before moving to the next section.

4. Write the Specification using the template below, then publish it to the project issue tracker. Apply the `ready-for-agent` triage label - no need for additional triage.

5. Output the issue URL so the user can pass it to `/write-tickets` next.

## Specification template

The Specification will be read by:

- **Humans** deciding whether the plan is sound.
- **`/write-tickets`** when breaking it into sub-issues.
- The **Specification-mode implement workflow** at the start of each sub-issue run (the prompt pulls in the Specification body for context).
- The **review workflow** when checking "does the PR match the spec?"

So the Specification must be a _spec_, not a sketch — concrete enough that a sub-issue agent can implement against it without re-deriving decisions.

### Behavior

BDD scenarios in Gherkin format grouped under level-4 headings by feature area. Write scenarios for:
- Each key user journey identified in the workflows
- Each business rule that has clear pass/fail conditions
- Edge cases and error conditions explicitly described in the analyses

Use this exact format for each scenario:

```gherkin
Scenario: [descriptive name]
  Given [precondition]
  When [action]
  Then [expected outcome]
```

Use `And` for additional steps within a clause. Keep scenarios concrete — use realistic example data rather than abstract placeholders. Source the happy paths from the interaction and codebase analyses; source the error conditions from codebase and database analyses (validation rules, constraints).

<prd-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my accounts.
Scenario: Customer sees account balance
  Given the customer is logged in to the mobile banking app
  When the customer navigates to the "Accounts" screen
  Then the customer sees a list of their accounts with the current balance for each account
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this PRD.

## Further Notes

Any further notes about the feature.

</prd-template>

## After publishing

- Tell the user: "PRD published at &lt;URL&gt;. Run `/write-tickets &lt;issue-number&gt;` to break it into sub-issues, then add `agent:implement` to start work."
- Do **not** add `agent:implement` yourself. The PRD has no sub-issues yet, so labeling it now would either silently bounce (regular single-issue workflow would try to run it as a leaf and might do unexpected work) or land in the wrong place. The user labels once sub-issues are in place.
