#!/usr/bin/env bash

set -e
set -u
set -o pipefail

NEW_VERSION="${1}"
RELEASE_BRANCH_PREFIX="release/"

if [[ -z $NEW_VERSION ]]; then
  echo "Error: No new version specified."
  exit 1
fi

RELEASE_BRANCH_NAME="${RELEASE_BRANCH_PREFIX}${NEW_VERSION}"
RELEASE_BODY="This is the release candidate for version ${NEW_VERSION}."

git config user.name gauthierpetetin-test
git config user.email gauthierpetetin-test@gmail.com

git checkout -b "${RELEASE_BRANCH_NAME}"

git push --set-upstream origin "${RELEASE_BRANCH_NAME}"

gh pr create \
  --draft \
  --title "${NEW_VERSION}" \
  --body "${RELEASE_BODY}" \
  --head "${RELEASE_BRANCH_NAME}";
