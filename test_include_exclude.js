// Test script to verify the include/exclude logic works correctly
const Labels = require('./lib/plugins/labels.js')

// Mock objects
const mockLog = {
  debug: (msg) => console.log('DEBUG:', msg),
  error: () => { }
}

const mockRepo = { repo: 'test-repo', owner: 'test-owner' }

// Test configuration with exclude pattern that matches everything BUT include should override
const entries = {
  include: [
    { name: 'PR_ENV', color: '0000FF', description: 'New description' }, // This should be processed even though it matches exclude pattern
    { name: 'NEW_LABEL', color: '00FF00', description: 'A new label' }
  ],
  exclude: [
    { name: '.*' } // Matches all labels, but include should override
  ]
}

// Create Labels instance
const labels = new Labels(true, null, mockRepo, entries, mockLog, [])

// Test the exclusion logic
console.log('Testing exclusion logic:')
console.log('isExcluded("bug"):', labels.isExcluded({ name: 'bug' }))
console.log('isExcluded("PR_ENV"):', labels.isExcluded({ name: 'PR_ENV' })) // This matches exclude pattern
console.log('isExcluded("NEW_LABEL"):', labels.isExcluded({ name: 'NEW_LABEL' }))

console.log('\nFiltered entries (should contain PR_ENV and NEW_LABEL):')
console.log(JSON.stringify(labels.entries, null, 2))

console.log('\nBUT the exclude pattern ".*" matches everything including PR_ENV')
console.log('The fix should ensure PR_ENV is NOT filtered out because it\'s in the include list')
