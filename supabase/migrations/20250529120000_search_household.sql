-- Global household search (recipes, lists, items, categories)
-- Requires: 20250529100000_initial_schema.sql and is_household_member (20250529100100+)

DO $guard$
BEGIN
  IF to_regclass('public.households') IS NULL THEN
    RAISE EXCEPTION
      'Saknar public.households. Kör alla migrationer från 20250529100000_initial_schema.sql först (t.ex. supabase db push).';
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.search_household(
  p_household_id uuid,
  p_query text,
  p_limit int DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pattern text;
  v_limit int;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_household_member(p_household_id) THEN
    RAISE EXCEPTION 'Not a household member';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 50);
  v_pattern := '%' || trim(COALESCE(p_query, '')) || '%';

  IF length(trim(COALESCE(p_query, ''))) < 1 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(sub.row ORDER BY sub.row->>'kind', sub.row->>'title'), '[]'::jsonb)
  INTO v_results
  FROM (
    (
      SELECT jsonb_build_object(
        'kind', 'recipe',
        'id', r.id,
        'title', r.title,
        'subtitle', rc.name,
        'href', '/h/' || p_household_id::text || '/recipes/' || r.id::text
      ) AS row
      FROM public.recipes r
      LEFT JOIN public.recipe_categories rc ON rc.id = r.recipe_category_id
      WHERE r.household_id = p_household_id
        AND r.title ILIKE v_pattern
      LIMIT v_limit
    )
    UNION ALL
    (
      SELECT jsonb_build_object(
        'kind', 'list',
        'id', sl.id,
        'title', sl.name,
        'subtitle', 'Inköpslista',
        'href', '/h/' || p_household_id::text || '/lists/' || sl.id::text
      ) AS row
      FROM public.shopping_lists sl
      WHERE sl.household_id = p_household_id
        AND sl.deleted_at IS NULL
        AND sl.name ILIKE v_pattern
      LIMIT v_limit
    )
    UNION ALL
    (
      SELECT jsonb_build_object(
        'kind', 'item',
        'id', si.id,
        'title', si.name,
        'subtitle', sl.name,
        'href', '/h/' || p_household_id::text || '/lists/' || sl.id::text
      ) AS row
      FROM public.shopping_items si
      JOIN public.shopping_lists sl ON sl.id = si.shopping_list_id
      WHERE sl.household_id = p_household_id
        AND sl.deleted_at IS NULL
        AND si.name ILIKE v_pattern
      LIMIT v_limit
    )
    UNION ALL
    (
      SELECT jsonb_build_object(
        'kind', 'category',
        'id', c.id,
        'title', c.name,
        'subtitle', 'Listkategori',
        'href', '/h/' || p_household_id::text || '/categories'
      ) AS row
      FROM public.categories c
      WHERE c.household_id = p_household_id
        AND c.name ILIKE v_pattern
      LIMIT v_limit
    )
    UNION ALL
    (
      SELECT jsonb_build_object(
        'kind', 'recipe_category',
        'id', rc.id,
        'title', rc.name,
        'subtitle', 'Receptkategori',
        'href', '/h/' || p_household_id::text || '/recipes'
      ) AS row
      FROM public.recipe_categories rc
      WHERE rc.household_id = p_household_id
        AND rc.name ILIKE v_pattern
      LIMIT v_limit
    )
  ) sub
  LIMIT v_limit;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_household(uuid, text, int) TO authenticated;
