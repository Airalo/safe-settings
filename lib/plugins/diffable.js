// Base class to make it easy to check for changes to a list of items
//
//     class Thing extends Diffable {
//       find() {
//       }
//
//       comparator(existing, attrs) {
//       }
//
//       changed(existing, attrs) {
//       }
//
//       update(existing, attrs) {
//       }
//
//       add(attrs) {
//       }
//
//       remove(existing) {
//       }
//     }
const ErrorStash = require('./errorStash')
const MergeDeep = require('../mergeDeep')
const NopCommand = require('../nopcommand')
const Glob = require('../glob')
const ignorableFields = ['id', 'node_id', 'default', 'url']
module.exports = class Diffable extends ErrorStash {
  constructor(nop, github, repo, entries, log, errors) {
    super(errors)
    this.github = github
    this.repo = repo
    this.entries = entries
    this.log = log
    this.nop = nop
  }

  filterEntries () {
    let filteredEntries = Array.from(this.entries)

    filteredEntries = filteredEntries.filter(attrs => {
      if (!Array.isArray(attrs.exclude)) return true

      const excludeGlobs = attrs.exclude.map(exc => new Glob(exc))
      const isExcluded = excludeGlobs.some(glob => glob.test(this.repo.repo))
      return !isExcluded
    })

    filteredEntries = filteredEntries.filter(attrs => {
      if (!Array.isArray(attrs.include)) return true

      const includeGlobs = attrs.include.map(exc => new Glob(exc))
      const isIncluded = includeGlobs.some(glob => glob.test(this.repo.repo))
      return isIncluded
    })

    filteredEntries = filteredEntries.map(e => {
      const { exclude, include, ...o } = e
      return o
    })
    return filteredEntries
  }

  sync () {
    const resArray = []
    if (this.entries) {
      let filteredEntries = this.filterEntries()
      // this.log.debug(`filtered entries are ${JSON.stringify(filteredEntries)}`)
      return this.find().then(existingRecords => {
        // Filter out excluded items from existing records before comparison if the child class has isExcluded method
        // This ensures the comparison results accurately reflect what will actually happen
        // IMPORTANT: Never exclude items that are also in the filteredEntries (include list)
        let filteredExistingRecords = existingRecords
        if (typeof this.isExcluded === 'function') {
          filteredExistingRecords = existingRecords.filter(existing => {
            // Don't exclude if this item is in our include list (filteredEntries)
            const isInIncludeList = filteredEntries.some(entry => this.comparator(existing, entry))
            if (isInIncludeList) {
              return true // Always keep items that are in the include list
            }
            // Otherwise, apply the exclusion rule
            return !this.isExcluded(existing)
          })
          this.log.debug(`Filtered ${existingRecords.length - filteredExistingRecords.length} excluded items from existing records (preserving include list items)`)
        }

        this.log.debug(` ${JSON.stringify(filteredExistingRecords, null, 2)} \n\n ${JSON.stringify(filteredEntries, null, 2)} `)

        const mergeDeep = new MergeDeep(this.log, this.github, ignorableFields)
        const compare = mergeDeep.compareDeep(filteredExistingRecords, filteredEntries)
        const results = { msg: 'Changes found', additions: compare.additions, modifications: compare.modifications, deletions: compare.deletions }
        this.log.debug(`Results of comparing ${this.constructor.name} diffable target ${JSON.stringify(filteredExistingRecords)} with source ${JSON.stringify(filteredEntries)} is ${JSON.stringify(results)}`)
        if (!compare.hasChanges) {
          this.log.debug(`There are no changes for ${this.constructor.name} for repo ${this.repo.repo}. Skipping changes`)
          return Promise.resolve()
        } else {
          if (this.nop) {
            resArray.push(new NopCommand(this.constructor.name, this.repo, null, results, 'INFO'))
          }
        }

        // Remove any null or undefined values from the diffables (usually comes from repo override)
        for (const entry of filteredEntries) {
          for (const key of Object.keys(entry)) {
            if (entry[key] === null || entry[key] === undefined) {
              delete entry[key]
            }
          }
        }
        // Delete any diffable that now only has name and no other attributes
        filteredEntries = filteredEntries.filter(entry => Object.keys(entry).filter(key => !MergeDeep.NAME_FIELDS.includes(key)).length !== 0)

        const changes = []

        // Use filteredExistingRecords instead of existingRecords for deletion processing
        filteredExistingRecords.forEach(x => {
          if (!filteredEntries.find(y => this.comparator(x, y))) {
            const change = this.remove(x).then(res => {
              if (this.nop) {
                return resArray.push(res)
              }
              return res
            })
            changes.push(change)
          }
        })

        filteredEntries.forEach(attrs => {
          // Use filteredExistingRecords instead of existingRecords for finding existing items
          const existing = filteredExistingRecords.find(record => {
            return this.comparator(record, attrs)
          })

          if (!existing) {
            const change = this.add(attrs).then(res => {
              if (this.nop) {
                return resArray.push(res)
              }
              return res
            })
            changes.push(change)
          } else if (this.changed(existing, attrs)) {
            const change = this.update(existing, attrs).then(res => {
              if (this.nop) {
                return resArray.push(res)
              }
              return res
            })
            changes.push(change)
          }
        })

        // if (changes.length === 0) {
        //   if (this.nop) {
        //     return Promise.resolve([
        //       // {plugin: this.constructor.name, repo: this.repo, action: `No changes`},
        //     ])
        //   }
        // }
        if (this.nop) {
          return Promise.resolve(resArray)
        }
        return Promise.all(changes)
      }).catch(e => {
        if (this.nop) {
          if (e.status === 404) {
            // Ignore 404s which can happen in dry-run as the repo may not exist.
            return Promise.resolve(resArray)
          } else {
            resArray.push(new NopCommand(this.constructor.name, this.repo, null, `error ${e} in ${this.constructor.name} for repo: ${JSON.stringify(this.repo)} entries ${JSON.stringify(this.entries)}`, 'ERROR'))
            return Promise.resolve(resArray)
          }
        } else {
          this.logError(`Error ${e} in ${this.constructor.name} for repo: ${JSON.stringify(this.repo)} entries ${JSON.stringify(this.entries)}`)
        }
      })
    }
  }
}
