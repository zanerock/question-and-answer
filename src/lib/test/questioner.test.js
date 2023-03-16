/* global afterAll beforeAll describe expect test */
import * as fsPath from 'node:path'
import { spawn } from 'node:child_process'

import { stdin } from 'mock-stdin'

import { simpleIB, simpleMapIB, simpleLocalMapIB, DO_YOU_LIKE_MILK, IS_THE_COMPANY_THE_CLIENT, IS_THIS_THE_END } from './test-data'
import { Questioner } from '../questioner'

const input = stdin()

jest.setTimeout(1000) // tried to set this in 'beforeAll', but it failed; we try and restore value 'afterAll' tests.

describe('Questioner', () => {
  afterAll(() => jest.setTimeout(5000)) // restore default

  test('can process a simple boolean question', (done) => {
    const questioner = new Questioner({ input })
    questioner.interogationBundle = simpleIB

    questioner.question().then(() => {
      expect(questioner.values.IS_CLIENT).toBe(true)
      done()
    })
    input.send('yes\n')
  })

  test.each([['yes', 'us'], ['no', 'them']])('Global map %s -> %s', (answer, mapping, done) => {
    const questioner = new Questioner({ input })
    questioner.interogationBundle = simpleMapIB

    questioner.question().then(() => {
      expect(questioner.values.ORG_COMMON_NAME).toBe(mapping)
      done()
    })
    input.send(answer + '\n')
  })

  test.each([['yes', 'us'], ['no', 'them']])('Local map %s -> %s', (answer, mapping, done) => {
    const questioner = new Questioner({ input })
    questioner.interogationBundle = simpleLocalMapIB

    questioner.question().then(() => {
      expect(questioner.values.ORG_COMMON_NAME).toBe(mapping)
      done()
    })
    input.send(answer + '\n')
  })

  test.each([['yes', DO_YOU_LIKE_MILK], ['no', IS_THIS_THE_END]]) // eslint-disable-line func-call-spacing
  ('Conditional question %s -> %s', (answer, followup, done) => { // eslint-disable-line no-unexpected-multiline
    const testScriptPath = fsPath.join(__dirname, 'conditional-question.js')

    // You cannot (as of Node 19.3.0) listen for events on your own stdout, so we have to create a child process.
    const child = spawn('node', [testScriptPath, answer])

    child.stdout.resume()
    child.stdout.once('data', (output) => {
      expect(output.toString().trim()).toBe(IS_THE_COMPANY_THE_CLIENT)

      child.stdout.once('data', (output) => {
        expect(output.toString().trim()).toBe(followup)
        child.stdin.write('yes\n')
        if (answer === 'yes') {
          child.stdin.write('yes\n')
        }

        child.kill('SIGINT')
        done()
      })
    })

    child.stdin.write(answer + '\n')
  })

  test.each([
    ['true', 'boolean', true],
    ['true', 'bool', true],
    ['true', 'string', 'true'],
    ['5', 'integer', 5],
    ['5.5', 'float', 5.5],
    ['6.6', 'numeric', 6.6]
  ])("Value '%s' type '%s' -> %p", (value, type, expected, done) => {
    const questioner = new Questioner({ input })
    const ib = structuredClone(simpleIB)
    ib.questions[0].paramType = type
    questioner.interogationBundle = ib

    questioner.question({ input }).then(() => {
      expect(questioner.values.IS_CLIENT).toBe(expected)
      done()
    })
    input.send(value + '\n')
  })
})
