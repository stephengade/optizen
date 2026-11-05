import { describe, expect, test } from 'bun:test'
import { findClientCommand, isReadOnlySql, splitSqlStatements } from '@launchpad/shared'
import { buildClientCommand, parseMysqlXml, parsePsqlOutput, parseSqliteJson } from './databases'

const US = '\x1f'
const RS = '\x1e'
const NUL = '\x1a'

describe('splitSqlStatements', () => {
  test('splits on top-level semicolons only', () => {
    expect(splitSqlStatements("select ';' as a; -- x;\nselect $$a;b$$; /* ; */ update t set a = 1")).toEqual([
      "select ';' as a",
      'select $$a;b$$',
      'update t set a = 1',
    ])
  })
})

describe('isReadOnlySql', () => {
  test('reads', () => {
    expect(isReadOnlySql('select 1; show tables; explain select 1; with x as (select 1) select * from x')).toBe(true)
    expect(isReadOnlySql('-- only a comment')).toBe(false)
  })
  test('writes', () => {
    expect(isReadOnlySql('select 1; delete from users')).toBe(false)
    expect(isReadOnlySql("insert into t values ('select')")).toBe(false)
    expect(isReadOnlySql('drop table t')).toBe(false)
  })
})

describe('findClientCommand', () => {
  test('blocks psql backslash commands outside strings', () => {
    expect(findClientCommand('postgres', String.raw`select 1 \! rm -rf /`)).toBe(String.raw`\!`)
    expect(findClientCommand('postgres', String.raw`\copy t to /tmp/x`)).toBe(String.raw`\copy`)
    expect(findClientCommand('postgres', String.raw`select E'a\nb', 'x\'`)).toBeNull()
  })
  test('blocks mysql client commands at line start', () => {
    expect(findClientCommand('mysql', 'select 1;\nsystem ls')).toBe('system')
    expect(findClientCommand('mysql', "select 'system ls'")).toBeNull()
  })
  test('blocks sqlite dot-commands', () => {
    expect(findClientCommand('sqlite', '.shell ls')).toBe('.shell')
    expect(findClientCommand('sqlite', 'select 1.5')).toBeNull()
  })
})

describe('parsePsqlOutput', () => {
  test('result sets, nulls, multi-line values and command tags', () => {
    const out =
      'INSERT 0 2\n' +
      `id${US}name${US}note${RS}1${US}a|b${US}${NUL}${RS}2${US}multi\nline${US}${RS}(2 rows)\n` +
      'UPDATE 2\n' +
      `x${RS}(0 rows)\n`
    const parsed = parsePsqlOutput(out)
    expect(parsed.messages).toEqual(['INSERT 0 2', 'UPDATE 2'])
    expect(parsed.results).toHaveLength(2)
    expect(parsed.results[0].columns).toEqual(['id', 'name', 'note'])
    expect(parsed.results[0].rows).toEqual([['1', 'a|b', null], ['2', 'multi\nline', '']])
    expect(parsed.results[1]).toEqual({ columns: ['x'], rows: [], rowCount: 0, truncated: false })
  })
})

describe('parseMysqlXml', () => {
  test('rows, nulls and entities', () => {
    const out = `<?xml version="1.0"?>

<resultset statement="select * from t" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <row>
	<field name="id">1</field>
	<field name="body">a &lt;b&gt; &amp; c</field>
	<field name="note" xsi:nil="true" />
  </row>
</resultset>
<resultset statement="select * from t where 0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
</resultset>`
    const parsed = parseMysqlXml(out)
    expect(parsed.results[0].columns).toEqual(['id', 'body', 'note'])
    expect(parsed.results[0].rows).toEqual([['1', 'a <b> & c', null]])
    expect(parsed.results[1].rowCount).toBe(0)
  })
})

describe('parseSqliteJson', () => {
  test('back-to-back arrays', () => {
    const parsed = parseSqliteJson('[{"id":1,"body":"x"},\n{"id":2,"body":null}]\n[{"n":3}]\n')
    expect(parsed.results.map((r) => r.rows)).toEqual([[['1', 'x'], ['2', null]], [['3']]])
  })
  test('keeps duplicate and numeric column names in order', () => {
    const parsed = parseSqliteJson(String.raw`[{"name":"notes","2":1.5,"name":"id","q":"a\"b, }"}]` + '\n')
    expect(parsed.results[0].columns).toEqual(['name', '2', 'name', 'q'])
    expect(parsed.results[0].rows).toEqual([['notes', '1.5', 'id', 'a"b, }']])
  })
})

describe('buildClientCommand', () => {
  test('keeps the password and SQL off the command line', () => {
    const cmd = buildClientCommand(
      { id: '1', serverId: 's', name: 'db', engine: 'postgres', access: 'docker', container: "pg'; rm -rf /", user: 'app', database: 'shop', createdAt: '', updatedAt: '' },
      'select 1',
      true,
      'hunter2'
    )
    expect(cmd.script).not.toContain('hunter2')
    expect(cmd.script).not.toContain('select 1')
    expect(cmd.script).toContain(`'pg'"'"'; rm -rf /'`)
    expect(cmd.script).toContain('default_transaction_read_only=on')
    expect(cmd.stdin).toBe('hunter2\nselect 1\n')
  })
})
