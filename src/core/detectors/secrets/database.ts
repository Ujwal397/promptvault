import type { Detector, RawFinding, Span } from '../../types'
import { makeFinding, matchAll } from '../util'
import { DETECTOR_VERSION, isPlaceholderValue, pickValue } from './helpers'

const DB_SCHEMES = 'postgres(?:ql)?|mysql|mariadb|mongodb(?:\\+srv)?|redis|rediss|amqps?|mssql|sqlserver|clickhouse'
const DB_SCHEME_SET = /^(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?|mssql|sqlserver|clickhouse|jdbc)$/i

const TAIL = '(?:[/?][^\\s"\'<>]{0,512})?'
const DB_URI_RE = new RegExp(
  `(?<![A-Za-z0-9+.-])(?<!jdbc:)(?:${DB_SCHEMES})://([^\\s:@/"'<>]{0,64}):([^\\s/"'<>]{1,128})@([^\\s@/"'<>?#]{1,255})${TAIL}`,
  'dgi',
)
const JDBC_RE = /(?<![A-Za-z0-9])jdbc:[a-z][a-z0-9]{1,19}:[^\s"'<>]{1,512}/gi
const JDBC_PARAM_RE = /[?&;](?:password|pwd)=([^&;\s"']{1,128})/gi
const JDBC_USERINFO_RE = /\/\/[^\s:@/"'<>]{0,64}:([^\s/"'<>]{1,128})@[^\s@/"'<>?#]{1,255}/
const JDBC_ORACLE_RE = /:thin:[^\s/@:"']{1,64}\/([^\s@"']{1,128})@/i
const PASSWORD_PARAM_RE = /[?&;](?:password|pwd|pass)=([^&;\s"']{1,128})/gi
const TRAILING_PUNCT_RE = /[.,;:!)]+$/

function trimUri(uri: string): string {
  return uri.replace(TRAILING_PUNCT_RE, '')
}

function dbFinding(id: string, start: number, end: number, subspans: Span[], label: string, explanation: string): RawFinding {
  return makeFinding({
    detectorId: id,
    detectorVersion: DETECTOR_VERSION,
    category: 'db_connection',
    start,
    end,
    severity: 'critical',
    confidence: 0.95,
    reasonCode: 'CONNECTION_STRING_PASSWORD',
    label,
    explanation,
    placeholderType: 'DB_CONNECTION',
    sensitiveSubspans: subspans,
  })
}

function paramSpans(re: RegExp, text: string, base: number): Span[] {
  const spans: Span[] = []
  for (const pm of matchAll(re, text)) {
    const value = pm[1]
    const trimmed = value ? value.trimEnd() : ''
    if (trimmed && !isPlaceholderValue(trimmed)) {
      const start = base + pm.index + pm[0].length - value.length
      spans.push({ start, end: start + trimmed.length })
    }
  }
  return spans
}

export const dbUriDetector: Detector = {
  id: 'secret.db-uri',
  version: DETECTOR_VERSION,
  category: 'db_connection',
  description: 'Database connection URI containing a password (postgres, mysql, mongodb, redis, amqp, ...)',
  examples: {
    positive: [
      'DATABASE_URL=postgres://app_user:Sup3rS3cret@db.example.com:5432/appdb',
      'mongodb+srv://admin:p4ssw0rd9@cluster0.example.net/test?retryWrites=true',
      'redis://:hunter2pw@cache.example.com:6379/0',
      'conn = "mysql://root:toor1234@localhost/db?password=other123"',
    ],
    negative: [
      'postgres://db.example.com:5432/appdb',
      'postgres://app_user@db.example.com/appdb',
      'postgres://app_user:${DB_PASS}@db.example.com/appdb',
      'postgres://app_user:[DB_PASSWORD_1]@db.example.com/appdb',
      'mongodb://host1:27017,host2:27017/test',
    ],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(DB_URI_RE, text)) {
      const pw = pickValue(m, 2)
      if (!pw || isPlaceholderValue(pw.value)) continue
      const uri = trimUri(m[0])
      const subspans: Span[] = [{ start: pw.start, end: pw.end }]
      subspans.push(...paramSpans(PASSWORD_PARAM_RE, uri, m.index))
      out.push(
        dbFinding(
          'secret.db-uri',
          m.index,
          m.index + uri.length,
          subspans,
          'Database connection string with password',
          'A database URI embeds a password in its user:password@host section.',
        ),
      )
    }
    return out
  },
}

export const jdbcDetector: Detector = {
  id: 'secret.jdbc-url',
  version: DETECTOR_VERSION,
  category: 'db_connection',
  description: 'JDBC URL carrying a password parameter or embedded credentials',
  examples: {
    positive: [
      'jdbc:mysql://db.example.com:3306/app?user=root&password=Zq81xLmn',
      'jdbc:postgresql://app:Sup3rS3cret@db.example.com/app',
      'jdbc:oracle:thin:scott/tiger9pw@db.example.com:1521:orcl',
    ],
    negative: [
      'jdbc:mysql://db.example.com:3306/app',
      'jdbc:mysql://db.example.com/app?user=root&password=${DB_PASS}',
      'jdbc:postgresql://db.example.com/app?password=[DB_PASSWORD_1]',
    ],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(JDBC_RE, text)) {
      const url = trimUri(m[0])
      const spans = paramSpans(JDBC_PARAM_RE, url, m.index)
      for (const re of [JDBC_USERINFO_RE, JDBC_ORACLE_RE]) {
        const um = re.exec(url)
        if (um && um[1] && !isPlaceholderValue(um[1])) {
          // The host part cannot contain '@', so the last '@' is the separator and the password ends right there.
          const start = m.index + um.index + um[0].lastIndexOf('@') - um[1].length
          spans.push({ start, end: start + um[1].length })
        }
      }
      if (spans.length === 0) continue
      out.push(
        dbFinding(
          'secret.jdbc-url',
          m.index,
          m.index + url.length,
          spans,
          'JDBC URL with password',
          'A JDBC URL contains a password parameter or embedded credentials.',
        ),
      )
    }
    return out
  },
}

const KV_START_RE =
  /(?<![A-Za-z0-9_])(?:Server|Data Source|Host|Driver|Provider|DSN|User ?Id|UID)[ \t]{0,2}=[^\r\n"']{0,1000}/gi
const KV_PASSWORD_RE = /(?:^|;)[ \t]{0,2}(?:Password|Pwd)[ \t]{0,2}=[ \t]{0,2}([^;]{1,128})/gi

export const connectionKeyValueDetector: Detector = {
  id: 'secret.db-keyvalue',
  version: DETECTOR_VERSION,
  category: 'db_connection',
  description: 'ADO.NET / ODBC style connection string (Server=...;Password=...;)',
  examples: {
    positive: [
      'Server=tcp:db.example.com,1433;Database=app;User Id=sa;Password=Zq81xLmnPw;Encrypt=True;',
      '"Data Source=db.example.com;Initial Catalog=app;Uid=admin;Pwd=hunter2pw"',
      'Driver={PostgreSQL};Server=localhost;Port=5432;Database=app;Uid=postgres;Pwd=s3cretpw1;',
    ],
    negative: [
      'Server=db.example.com;Database=app;Integrated Security=true;',
      'Server=db.example.com;User Id=sa;Password=${DB_PASS};',
      'Server=db.example.com;User Id=sa;Password=[DB_PASSWORD_1];',
      'Host=localhost; Password=;',
    ],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(KV_START_RE, text)) {
      const segment = m[0].trimEnd()
      const spans = paramSpans(KV_PASSWORD_RE, segment, m.index)
      if (spans.length === 0) continue
      out.push(
        dbFinding(
          'secret.db-keyvalue',
          m.index,
          m.index + segment.length,
          spans,
          'Connection string with password',
          'A key=value connection string contains a Password/Pwd entry.',
        ),
      )
    }
    return out
  },
}

const URL_PASSWORD_RE =
  /(?<![A-Za-z0-9+.-])([A-Za-z][A-Za-z0-9+.-]{1,15}):\/\/[^\s:@/"'<>]{1,64}:([^\s/"'<>]{1,128})@[^\s@/"'<>?#]{1,255}/dg

export const urlPasswordDetector: Detector = {
  id: 'secret.url-password',
  version: DETECTOR_VERSION,
  category: 'credential',
  description: 'Password embedded in a non-database URL (https://user:pass@host, ftp://...)',
  examples: {
    positive: ['git clone https://deploy:Zq81xLmnPw@git.example.com/org/repo.git', 'ftp://backup:s3cretpw1@files.example.com/'],
    negative: [
      'https://example.com:8080/path',
      'https://user@example.com/path',
      'https://user:${TOKEN}@example.com/',
      'https://user:[URL_PASSWORD_1]@example.com/',
      'postgres://app_user:Sup3rS3cret@db.example.com/appdb',
    ],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(URL_PASSWORD_RE, text)) {
      if (DB_SCHEME_SET.test(m[1])) continue
      const pw = pickValue(m, 2)
      if (!pw || pw.value.length < 3 || isPlaceholderValue(pw.value)) continue
      out.push(
        makeFinding({
          detectorId: 'secret.url-password',
          detectorVersion: DETECTOR_VERSION,
          category: 'credential',
          start: pw.start,
          end: pw.end,
          severity: 'critical',
          confidence: 0.9,
          reasonCode: 'URL_USERINFO_PASSWORD',
          label: 'Password in URL',
          explanation: 'A URL contains a password in its user:password@host section.',
          placeholderType: 'URL_PASSWORD',
        }),
      )
    }
    return out
  },
}

export const DATABASE_DETECTORS: Detector[] = [dbUriDetector, jdbcDetector, connectionKeyValueDetector, urlPasswordDetector]
