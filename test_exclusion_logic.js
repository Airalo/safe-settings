// Test script to verify the exclusion logic works correctly
const Labels = require('./lib/plugins/labels.js')

// Mock objects
const mockLog = {
  debug: () => { },
  error: () => { }
}

const mockGithub = {
  issues: {
    listLabelsForRepo: {
      endpoint: {
        merge: () => { }
      }
    }
  },
  repos: {
    get: () => Promise.resolve()
  },
  paginate: () => Promise.resolve([
    { name: 'bug', color: 'd73a4a', description: 'Something isn\'t working' },
    { name: 'enhancement', color: 'a2eeef', description: 'New feature or request' },
    { name: 'PR_ENV', color: 'FDE22C', description: 'existing description' }
  ])
}

const mockRepo = { repo: 'test-repo', owner: 'test-owner' }

// Test configuration with exclude pattern that matches everything
const entries = {
  include: [
    { name: 'PR_ENV', color: '0000FF', description: 'New description' },
    { name: 'NEW_LABEL', color: '00FF00', description: 'A new label' }
  ],
  exclude: [
    { name: '.*' } // Matches all labels
  ]
}

// Create Labels instance
const labels = new Labels(true, mockGithub, mockRepo, entries, mockLog, [])

// Test the exclusion logic
console.log('Testing exclusion logic:')
console.log('isExcluded("bug"):', labels.isExcluded({ name: 'bug' }))
console.log('isExcluded("enhancement"):', labels.isExcluded({ name: 'enhancement' }))
console.log('isExcluded("PR_ENV"):', labels.isExcluded({ name: 'PR_ENV' }))

// Test the sync method (this should show accurate comparison results)
labels.sync().then(result => {
  console.log('\nSync completed successfully')
  console.log('Result:', result)
}).catch(err => {
  console.error('Sync failed:', err)
})
