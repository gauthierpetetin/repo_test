const { Octokit } = require("@octokit/core");
const { graphql } = require("@octokit/graphql");

const githubToken = process.env.GITHUB_TOKEN;
const prNumber = process.env.PR_NUMBER;
const prRepo = process.env.PR_REPO;
const prRepoOwner = prRepo.split('/')[0];
const prRepoName = prRepo.split('/')[1];

// Next release cut number is defined thanks NEXT_RELEASE_CUT_NUMBER env variable.
// NEXT_RELEASE_CUT_NUMBER is defined in section "Secrets and variables">"Actions">"Variables">"New repository variable" in the settings of this repo.
// NEXT_RELEASE_CUT_NUMBER needs to be updated every time a new release is cut.
// Example value: 6.5
const nextReleaseCutNumber = process.env.NEXT_RELEASE_CUT_NUMBER;
if (!nextReleaseCutNumber) {
  throw new Error("The NEXT_RELEASE_CUT_NUMBER environment variable is not defined.");
}
            
// Release label needs to indicate the next release cut number
// Example release label: "release-6.5"
const releaseLabel = `release-{nextReleaseCutNumber}`;

const octokit = new Octokit({ auth: githubToken });

const QUERY = `
  query($prRepoOwner: String!, $prRepoName: String!, $prNumber: Int!) {
    repository(owner: $prRepoOwner, name: $prRepoName) {
      pullRequest(number: $prNumber) {
        timelineItems(itemTypes: [CONNECTED_EVENT, DISCONNECTED_EVENT], first: 100) {
          nodes {
            ... on ConnectedEvent {
              __typename
              createdAt
              subject {
                ... on Issue {
                  number
                  title
                  id
                  url
                  repository {
                    name
                    owner {
                      login
                    }
                  }
                }
              }
            }
            ... on DisconnectedEvent {
              __typename
              createdAt
              subject {
                ... on Issue {
                  number
                  title
                  id
                  url
                  repository {
                    name
                    owner {
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

(async () => {
  const result = await graphql(QUERY, {
    prRepoOwner,
    prRepoName,
    prNumber,
    headers: {
      authorization: `token ${githubToken}`,
    },
  });

  const connectedIssues = new Set();
  const timelineItems = result.repository.pullRequest.timelineItems.nodes;

  timelineItems.forEach((item) => {
    if (item.__typename === "ConnectedEvent") {
      connectedIssues.add(item.subject);
    } else if (item.__typename === "DisconnectedEvent") {
      connectedIssues.delete(item.subject);
    }
  });

  // Add the release label to the PR
  await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
    owner,
    repo,
    issue_number: prNumber,
    labels: [releaseLabel],
  });

  // Add the release label to the connected issues
  for (const issue of connectedIssues) {
    await octokit.request("POST /repos/{owner}/{
                          
  // Add the release label to the connected issues
  for (const issue of connectedIssues) {
    await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
      owner: issue.repository.owner.login,
      repo: issue.repository.name,
      issue_number: issue.number,
      labels: [releaseLabel],
    });
  }
})().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
