---
name: author-instructional-videos
description: Create or refresh narrated instructional videos with captions and real demo evidence using the packaged litai video commands. Use for project tutorial courses, not slide decks or speculative product commercials.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Author instructional videos

Use `litai video init` to start an editable course package, `plan` to validate
its manifest and assets, `build` to render, and `verify --manifest` to detect
stale inputs or damaged output. Run `litai help video` for the installed syntax.
Keep manifests, owned assets, and sanitized factual evidence under the project's
documentation root; render intermediates under ignored build custody.

## Separate craft from the project's story

This skill owns instructional craft, not a cast or house narrative. The consuming
project chooses audience, presenters, speaker count, tone, humor, visual identity,
and story in its own authoring package. Do not inherit this framework's mascots,
dialogue, gender assignments, voice IDs, or two-character format. A solo demo,
interview, documentary, or another appropriate format is equally valid.

## Design for understanding and attention

- Start with a recognizable problem and show the useful outcome early. Storyboard
  what the viewer sees alongside what they hear; avoid a narration script with
  bullet slides added afterward. Give each shot a teaching purpose.
- Prefer the actual interface, code change, before/after result, or a visual
  explanation of relationships. Use on-screen text for commands, labels and
  emphasis, not paragraphs the narrator reads aloud. Pace reveals and close-ups
  to the explanation, preserving readable code and enough time to follow actions.
- For getting-started content, include the real acquisition URL, supported
  prerequisites, installation, PATH/environment activation, authentication when
  needed, first command, expected result, and a useful failure/recovery example.
  Assume a new viewer does not already have the author's configured machine.
- Match delivery to the audience. If the project chooses dialogue, let questions,
  objections, discoveries and reactions change the demonstration; do not alternate
  two voices reading independent lectures. Humor is an optional project choice,
  not a framework requirement, and must not obscure the instructions.

## Audition before producing a series

Produce a short representative review cut with the intended voices, a visual
demonstration, and captions before expensive full rendering. Listen for natural
prosody, pronunciation, appropriate pauses and consistent levels. Stock system
speech is a scratch-track option, not proof of publication-quality narration.
Use suitable recorded or neural narration, with provider, model/voice, rights,
and regeneration inputs recorded. Do not silently install tools, imitate a real
person, or send project text to an unapproved cloud service. Retain approved audio
so another host can rebuild without that provider.

## Prove content and review the viewing experience

Demonstrate real commands, code changes, and observable results in disposable
projects; identify tested revisions. Never fabricate successful transcripts.
Label replays, speed changes, edits, and walkthrough-only steps in the video.
A media receipt proves integrity, not factual correctness or presentation quality.

Inspect every shot at playback size, listen to the complete soundtrack, and review
captions for timing, readable line lengths, speaker attribution when useful, and
collision with important UI. Check that the viewer can follow the installation
and example without unstated steps. Record human review separately from media
verification; an attractive contact sheet cannot substitute for watching a cut.

Rebuild after changing evidence, dialogue, recordings, or assets; retain prior
outputs until their replacement is accepted. Scan media, captions and evidence
for credentials and private endpoints. Publish only to the authorized destination;
rendering grants neither publication nor demo-execution authority.
