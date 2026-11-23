-- Describes the public schema as JSON for scripts/gen-types.mjs.
\pset tuples_only on
\pset format unaligned
select jsonb_build_object(
  'tables', (
    select coalesce(jsonb_agg(t order by t ->> 'name'), '[]') from (
      select jsonb_build_object(
        'name', c.relname,
        'columns', (
          select jsonb_agg(jsonb_build_object(
              'name', col.column_name,
              'type', col.data_type,
              'element', (select e.data_type from information_schema.element_types e
                          where e.object_schema = 'public' and e.object_name = c.relname
                            and e.collection_type_identifier = col.dtd_identifier),
              'nullable', col.is_nullable = 'YES',
              'has_default', col.column_default is not null
            ) order by col.column_name)
          from information_schema.columns col
          where col.table_schema = 'public' and col.table_name = c.relname
        ),
        'relationships', (
          select coalesce(jsonb_agg(jsonb_build_object(
              'name', con.conname,
              'columns', (select jsonb_agg(a.attname order by k.ord)
                          from unnest(con.conkey) with ordinality k(attnum, ord)
                          join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum),
              'one_to_one', false,
              'ref_table', rc.relname,
              'ref_columns', (select jsonb_agg(a.attname order by k.ord)
                              from unnest(con.confkey) with ordinality k(attnum, ord)
                              join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum)
            ) order by con.conname), '[]')
          from pg_constraint con
          join pg_class rc on rc.oid = con.confrelid
          join pg_namespace rn on rn.oid = rc.relnamespace
          where con.conrelid = c.oid and con.contype = 'f' and rn.nspname = 'public'
        )
      ) as t
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    ) s
  ),
  'views', (
    select coalesce(jsonb_agg(v order by v ->> 'name'), '[]') from (
      select jsonb_build_object(
        'name', c.relname,
        'columns', (
          select jsonb_agg(jsonb_build_object('name', col.column_name, 'type', col.data_type,
                                              'nullable', true, 'has_default', false)
                           order by col.column_name)
          from information_schema.columns col
          where col.table_schema = 'public' and col.table_name = c.relname
        )
      ) as v
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'v'
    ) s
  ),
  'functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
        'name', p.proname,
        'returns', format_type(p.prorettype, null),
        'args', (select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'type', format_type(a.type, null))
                                           order by a.name), '[]')
                 from unnest(coalesce(p.proargnames, array[]::text[]), p.proargtypes::oid[]) as a(name, type))
      ) order by p.proname), '[]')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype
  )
);
