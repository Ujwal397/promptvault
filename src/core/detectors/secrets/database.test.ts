import { describe, expect, it } from 'vitest'
import {
  connectionKeyValueDetector,
  DATABASE_DETECTORS,
  dbUriDetector,
  jdbcDetector,
  urlPasswordDetector,
} from './database'
import { describeExamples } from './testing'

describeExamples(DATABASE_DETECTORS)

const sub = (text: string, spans?: { start: number; end: number }[]) =>
  (spans ?? []).map((s) => text.slice(s.start, s.end))

describe('db uri', () => {
  it('span is the URI; subspan is the password', () => {
    const uri = 'postgres://app_user:Sup3rS3cret@db.example.com:5432/appdb'
    const text = `url: ${uri}.`
    const [f] = dbUriDetector.detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(uri)
    expect(sub(text, f.sensitiveSubspans)).toEqual(['Sup3rS3cret'])
    expect(f.category).toBe('db_connection')
    expect(f.severity).toBe('critical')
    expect(f.placeholderType).toBe('DB_CONNECTION')
  })

  it('also marks the password query parameter', () => {
    const text = 'mysql://root:toor1234@localhost/db?password=other123'
    const [f] = dbUriDetector.detect({ text })
    expect(sub(text, f.sensitiveSubspans)).toEqual(['toor1234', 'other123'])
  })

  it('handles empty user (redis)', () => {
    const text = 'redis://:hunter2pw@cache:6379'
    const [f] = dbUriDetector.detect({ text })
    expect(sub(text, f.sensitiveSubspans)).toEqual(['hunter2pw'])
  })
})

describe('jdbc', () => {
  it('password param subspan', () => {
    const text = 'jdbc:mysql://db/app?user=root&password=Zq81xLmn'
    const [f] = jdbcDetector.detect({ text })
    expect(sub(text, f.sensitiveSubspans)).toEqual(['Zq81xLmn'])
    expect(text.slice(f.startOffset, f.endOffset)).toBe(text)
  })

  it('oracle thin and userinfo forms', () => {
    const o = 'jdbc:oracle:thin:scott/tiger9pw@db:1521:orcl'
    expect(sub(o, jdbcDetector.detect({ text: o })[0].sensitiveSubspans)).toEqual(['tiger9pw'])
    const u = 'jdbc:postgresql://app:Sup3rS3cret@db/app'
    expect(sub(u, jdbcDetector.detect({ text: u })[0].sensitiveSubspans)).toEqual(['Sup3rS3cret'])
    expect(dbUriDetector.detect({ text: u })).toEqual([])
  })
})

describe('key/value connection strings', () => {
  it('span is whole string, subspan the password', () => {
    const cs = 'Server=tcp:db,1433;Database=app;User Id=sa;Password=Zq81xLmnPw;Encrypt=True;'
    const text = `cs = "${cs}"`
    const [f] = connectionKeyValueDetector.detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(cs)
    expect(sub(text, f.sensitiveSubspans)).toEqual(['Zq81xLmnPw'])
  })

  it('Pwd= variant', () => {
    const text = 'Data Source=db;Uid=admin;Pwd=hunter2pw'
    const [f] = connectionKeyValueDetector.detect({ text })
    expect(sub(text, f.sensitiveSubspans)).toEqual(['hunter2pw'])
  })
})

describe('url password', () => {
  it('span is password only, category credential', () => {
    const text = 'git clone https://deploy:Zq81xLmnPw@git.example.com/o/r.git'
    const [f] = urlPasswordDetector.detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe('Zq81xLmnPw')
    expect(f.category).toBe('credential')
    expect(f.placeholderType).toBe('URL_PASSWORD')
  })
})
