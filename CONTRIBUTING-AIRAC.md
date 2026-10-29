# Contributing to French vACC vATIS profiles

Follow .github/CODEOWNERS for reviews. Keep PRs focused, cite operational sources and describe verification. Authors cannot approve their own PRs.

Keep existing profile IDs unchanged so controllers continue to receive automatic updates. Update the updateSerial of each changed profile as appropriate, validate its JSON and check the affected airports in vATIS. The existing JSON validation and profile-ID workflows remain in place.

For AIRAC-dependent changes, tick the dependency checkbox and apply the matching airac/XXXX label, or ask a maintainer. The label activates the gate; the checkbox alone does not. Dates are defined in .github/airac-cycles.yml. The latest date wins if several labels are present; unknown labels fail.

The AIRAC merge gate status opens at or after 00:00 UTC on the effective date, on its next evaluation. Scheduled refreshes run every 15 minutes and can be delayed by GitHub. The bot comment updates in place; effective labels remain on open PRs.

Auto-merge still waits for all required reviews and checks. The gate does not enable it on your behalf or choose squash merging. Do not remove dependency labels to merge early without maintainer review.

Settings are in .github/airac-config.json. Cycle tags are disabled by default; enabled tags snapshot the default branch at run time and do not wait for later PR merges. Extend the calendar before it expires.

Automation changes have a dedicated test workflow. Maintainers can also run node --test .github/scripts/airac.test.cjs from the repository root. This is an automation test suite, not an operational-data validator.

