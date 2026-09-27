# Audio Capture: Scope Decision

## The gap

Chapter 1's scope names online lectures, webinars, Google Meet, and
YouTube as target environments (Table 2 lists them explicitly as
"Testing environment for real-time web audio capture"). The Web
Speech API — the technology the pre-proposal, dictionary, and
Chapter 3 methodology all commit to — only has access to the
device **microphone**. It cannot listen to a browser tab's audio
output. As currently built, the extension transcribes whoever is
speaking near the microphone, not the audio playing in a video.

This is a real mismatch between the written scope and what the
chosen technology can do, not a bug to patch.

## Options considered

**A. System/loopback audio routing (user-side workaround).**
Ask the user to route tab audio into their microphone input via
OS-level loopback (Windows Stereo Mix, or a virtual audio cable).
Requires no code changes. Downsides: a manual setup step outside
the extension's control, inconsistent across OS/hardware, and
likely to hurt System Usability Scale (SUS) scores directly, since
it adds friction before the tool even works.

**B. `chrome.tabCapture` + offscreen document.**
Chrome extensions can capture a tab's `MediaStream` directly. The
catch: the Web Speech API does not accept a `MediaStream` as input —
it only listens to the default microphone. Making this work would
require running a separate ASR engine against the captured stream
(e.g., Whisper via `transformers.js` running locally, or the
already-planned optional Flask backend receiving audio over a
WebSocket). This is the technically correct fix for the stated
scope, but it is a substantial build: new permission model, offscreen
document lifecycle, a second recognition pipeline, and testing on a
second codepath alongside the mic-based one.

**C. Narrow the written scope to match the built technology.**
Reframe the target use case as live spoken input — a teacher
speaking in a classroom, a counter-service interaction, a live
presenter — rather than audio already inside a browser tab. No
architecture change; only Chapter 1/3 wording changes.

## Decision

**Go with Option C for the current build, and document Option B as
future work**, for one concrete reason: the thesis's own Scope and
Limitation section (Ch. 1) already states the study "will not cover
the development of a comprehensive sign language translation
system" and exists to "demonstrate the feasibility of integrating
speech-to-sign translation within a browser-based environment."
A live-speaker-input system fully satisfies that framing and is
achievable within the remaining timeline. Tab-audio capture is a
second, harder engineering problem layered on top of the FSL
translation problem the thesis is actually about — solving it
would not make the translation component more correct, only widen
where the audio can come from.

### What changes in the written thesis

- Ch. 1 Background / Proposed Solution: replace "video lectures,
  webinars, audio announcements" framing with live spoken input —
  a presenter, teacher, or counter-service staff member speaking
  directly, with the browser open on the relevant page (e.g., an
  LMS, a government service portal) for context, not as the audio
  source.
- Ch. 1 Scope and Limitation: add an explicit line — "Audio is
  captured from the user's microphone; the system does not capture
  or transcribe audio playing from other browser tabs or embedded
  media." This is consistent in spirit with the existing limitation
  that the system won't handle "advanced gesture dynamics" — it's
  another honest, stated boundary rather than a hidden one.
- Ch. 5 (or wherever future work goes): note `chrome.tabCapture`
  + a Whisper-based or Flask-backed recognition pipeline as the
  natural next step for extending the system to tab audio, tying
  back to the pre-proposal's "optional Python Flask API for backend
  processing" line — which already anticipated exactly this kind
  of extension.

## What this doesn't block

Nothing else in the current build depends on this decision. The
translator, dictionary, phrase mappings, and playback queue all
work identically regardless of where the audio comes from — this
was purely a scope-vs-capability question, and it now has a
citable answer.
