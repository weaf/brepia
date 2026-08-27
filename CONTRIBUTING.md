# Contributing to Brepia

When contributing to this repository, please first discuss substantial changes through [issues](https://github.com/weaf/pCAD/issues) before opening a large pull request.

Please note that this repository has a [code of conduct](CODE_OF_CONDUCT.md); follow it in all interactions with the project.

## Pull Request Process

1. **Fork the project** - Create a fork of the repository in your own GitHub account.

   ![Fork](https://docs.github.com/assets/cb-40742/mw-1440/images/help/repository/fork-button.webp)

2. **Create your changes** - Make your changes in your fork and open a PR from that fork.

3. **Update the PR description** - Explain the change and link the relevant issue when applicable.

4. **Allow maintainer edits** - Check "Allow edits from maintainer" so maintainers can help update the PR when necessary. [Learn more here](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/allowing-changes-to-a-pull-request-branch-created-from-a-fork).

5. **Request a review** - Request review from a maintainer. Once accepted, the PR can be merged.

## Brepia compatibility boundaries

Brepia contains compatibility-sensitive identifiers inherited from pCAD/CADAM. Do not rename internal `pcad`, `cadam` or `adam` identifiers solely for cosmetic consistency. Check [`docs/brepia_branding.md`](docs/brepia_branding.md) and the current remake status before changing routing, environment variables, database/storage identifiers, agent IDs, external integration IDs or historical references.

## Style Guide

We try to follow the Boy Scout Rule:

> "Leave the code cleaner, not messier, than how you found it."
