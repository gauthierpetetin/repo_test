import { context, getOctokit } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';

main().catch((error: Error): void => {
  console.error(error);
  process.exit(1);
});

async function main(): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    core.setFailed('GITHUB_TOKEN not found');
    process.exit(1);
  }
  
  const nextReleaseCutNumber = process.env.NEXT_RELEASE_CUT_NUMBER;
  if (!nextReleaseCutNumber) {
    // NEXT_RELEASE_CUT_NUMBER is defined in section "Secrets and variables">"Actions">"Variables">"New repository variable" in the settings of this repo.
    // NEXT_RELEASE_CUT_NUMBER needs to be updated every time a new release is cut.
    // Example value: 6.5
    core.setFailed('NEXT_RELEASE_CUT_NUMBER not found');
    process.exit(1);
  }
  
  // Release label needs indicates the next release cut number
  // Example release label: "release-6.5"
  const releaseLabelName = `release-{nextReleaseCutNumber}`;
  const releaseLabelColor = "000000"

  // Initialise octokit to call Github GraphQL API
  const octokit = getOctokit(githubToken);

  // Get PR info from context
  const prRepoOwner = context.repo.owner;
  const prRepoName = context.repo.repo;
  const prNumber = context.payload.pull_request.number;
  
  
}

// This function retrieves the repo
async function retrieveRepo(octokit, repoOwner: string, repoName: string): Promise<string> {
  
  const retrieveRepoQuery = `
  query RetrieveRepo($repoOwner: String!, $repoName: String!) {
    repository(owner: $repoOwner, name: $repoName) {
      id
    }
  }
`;
  
  const retrieveRepoResult = await octokit.graphql(retrieveRepoQuery, {
    repoOwner,
    repoName,
    labelName,
  });

  const repoId = retrieveRepoResult?.repository?.id;

  return repoId;
}

// This function retrieves the label on a specific repo
async function retrieveLabel(octokit, repoOwner: string, repoName: string, labelName: string): Promise<string> {
  
  const retrieveLabelQuery = `
    query RetrieveLabel($repoOwner: String!, $repoName: String!, $labelName: String!) {
      repository(owner: $repoOwner, name: $repoName) {
        label(name: $labelName) {
          id
        }
      }
    }
  `;
  
  const retrieveLabelResult = await octokit.graphql(retrieveLabelQuery, {
    repoOwner,
    repoName,
    labelName,
  });

  const labelId = retrieveLabelResult?.repository?.label?.id;

  return labelId;
}

// This function creates the label on a specific repo
async function createLabel(octokit, repoId: string, labelName: string, labelColor: string): Promise<string> {
  
  const createLabelMutation = `
    mutation CreateLabel($repoId: ID!, $labelName: String!, $labelColor: String!) {
      createLabel(input: {repositoryId: $repoId, name: $labelName, color: $labelColor}) {
        label {
          id
        }
      }
    }
  `;
  
  const createLabelResult = await octokit.graphql(createLabelMutation, {
    repoId,
    labelName,
    labelColor,
  });

  const labelId = createLabelResult?.createLabel?.label?.id;

  if (!releaseLabelId) {
    throw new Error("Shall never happen: labelId not defined for created label");
  }
  
  return labelId;
}

// This function creates or retrieves the label on a repo
async function createOrRetrieveLabel(octokit, repoOwner: string, repoName: string, labelName: string, labelColor: string): Promise<string> {
  
  // Check if label already exists on repo
  let labelId = await retrieveLabel(octokit, repoOwner, repoName, labelName);

  // If label doesn't exist on repo, create it
  if (!labelId) {
    // Retrieve PR's repo
    const repoId = await retrieveRepo(octokit, repoOwner, repoName);
    
    // Create label on repo
    labelId = await createLabel(octokit, repoId, labelName, labelColor);
  }
  
  return labelId;
}





// Step1: Create release label if it doesn't exist


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
