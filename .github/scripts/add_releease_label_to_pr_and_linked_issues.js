const { GitHub, context } = require("@actions/github");

const githubToken = process.env.GITHUB_TOKEN;
const prNumber = process.env.PR_NUMBER;
const prRepo = process.env.PR_REPO;
const prRepoOwner = prRepo.split('/')[0];
const prRepoName = prRepo.split('/')[1];

// Initialise octokit to call Github GraphQL API
const octokit = new GitHub(githubToken);

// Step1: Create release label if it doesn't exist

const nextReleaseCutNumber = process.env.NEXT_RELEASE_CUT_NUMBER;
if (!nextReleaseCutNumber) {
  // NEXT_RELEASE_CUT_NUMBER is defined in section "Secrets and variables">"Actions">"Variables">"New repository variable" in the settings of this repo.
  // NEXT_RELEASE_CUT_NUMBER needs to be updated every time a new release is cut.
  // Example value: 6.5
  throw new Error("The NEXT_RELEASE_CUT_NUMBER environment variable is not defined.");
}
            
// Release label needs indicates the next release cut number
// Example release label: "release-6.5"
const releaseLabelName = `release-{nextReleaseCutNumber}`;
const releaseLabelColor = "000000"

const getLabelQuery = `
  query GetLabel($prRepoOwner: String!, $prRepoName: String!, $releaseLabelName: String!) {
    repository(owner: $prRepoOwner, name: $prRepoName) {
      id
      label(name: $releaseLabelName) {
        id
        name
      }
    }
  }
`;

const createLabelMutation = `
  mutation CreateLabel($repoId: ID!, $releaseLabelName: String!, $releaseLabelColor: String!) {
    createLabel(input: {repositoryId: $repoId, name: $releaseLabelName, color: $releaseLabelColor}) {
      label {
        id
        name
      }
    }
  }
`;

const labelResult = await octokit.graphql(getLabelQuery, {
  prRepoOwner,
  prRepoName,
  releaseLabelName,
});

const repoId = labelResult?.repository?.id;

let releaseLabelId = labelResult?.repository?.label?.id;
if (!releaseLabelId) {
  const createLabelResult = await octokit.graphql(createLabelMutation, {
    repoId,
    releaseLabelName,
    releaseLabelColor,
  });
  releaseLabelId = createLabelResult?.createLabel?.label?.id;
}

if (!releaseLabelId) {
  throw new Error("Shall never happen: release label is not defined.");
}


// Step2: Fetch PR's id (required for GraphQL queries)

const getPullRequestIdQuery = `
  query GetPullRequestId($prRepoOwner: String!, $prRepoName: String!, $prNumber: Int!) {
    repository(owner: $prRepoOwner, name: $prRepoName) {
      pullRequest(number: $prNumber) {
        id
      }
    }
  }
`;

const pullRequestIdResult = await octokit.graphql(getPullRequestIdQuery, {
  prRepoOwner,
  prRepoName,
  prNumber,
});

const prId = pullRequestIdResult?.repository?.pullRequest?.id;

// Fetch PR's list of linked issues (deduced from timeline events)
const QUERY = `
  query($releaseLabelName: String!, $prRepoOwner: String!, $prRepoName: String!, $prNumber: Int!) {
    repository(owner: $prRepoOwner, name: $prRepoName) {
      label(name: $releaseLabelName) {
        id
      }
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
  // Fetch PR's list of linked issues (deduced from timeline events)
  const result = await graphql(QUERY, {
    releaseLabelName,
    prRepoOwner,
    prRepoName,
    prNumber,
    headers: {
      authorization: `token ${githubToken}`,
    },
  });
  
  // In case release label doesn't exist, it needs to be created
  let releaseLabelId = result?.data?.repository?.label?.id;
  if(!releaseLabelId) {
    const createLabelMutation = `
      mutation CreateLabel($repoId: ID!, $name: String!, $color: String!) {
        createLabel(input: {repositoryId: $repoId, name: $name, color: $color}) {
          label {
            id
            name
          }
        }
      }
    `;
    
    const createLabelResult = await octokit.graphql(createLabelMutation, {
      repoId,
      name: releaseLabelName,
      color: labelColor,
    });
    labelId = createLabelResult.createLabel.label.id;
  }
  
  const timelineItems = result?.data?.repository?.pullRequest?.timelineItems?.nodes;

  // Use the PR's timeline events to deduce the linked issues
  // This is not straightforward, but there's currently no easier way to obtain linked issues thanks to Github APIs)
  const linkedIssuesMap = {};

  timelineItems?.forEach((item) => {
    const issue = item.subject;

    if (item.__typename === 'ConnectedEvent') {
      linkedIssuesMap[issue.id] = {
        id: issue.id,
        number: issue.number,
        owner: issue.repository.owner.login,
        repo: issue.repository.name,
        createdAt: item.createdAt,
        url: issue.url // Not sure we need this
      };
    } else if (item.__typename === 'DisconnectedEvent') {
      const linkedIssue = linkedIssuesMap[issue.id];

      if (linkedIssue && new Date(item.createdAt) > new Date(linkedIssue.createdAt)) {
        delete linkedIssuesMap[issue.id];
      }
    }
  });

  const linkedIssues = Object.values(linkedIssuesMap);
  
  // Add release label to PR and connected issues using GraphQL mutations
  const addLabelMutation = `
    mutation addLabelsToLabelable($labelableId: ID!, $labelIds: [ID!]!) {
      addLabelsToLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
        clientMutationId
      }
    }
  `;
  
  // Add the release label to the PR
  await octokit.graphql(addLabelMutation, {
    labelableId: prId,
    labelIds: [releaseLabelId],
  });
                          
  // Add the release label to the linked issues
  for (const issue of linkedIssues) {
    await octokit.graphql(addLabelMutation, {
      labelableId: issue.id,
      labelIds: [releaseLabelId],
    });
  }
    
})().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
