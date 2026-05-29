-- Household members may read profiles of other members in the same household
-- (required for members list and list creator display names).

CREATE POLICY "profiles_select_household_peers" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.household_members AS mine
      INNER JOIN public.household_members AS peer
        ON mine.household_id = peer.household_id
      WHERE mine.user_id = auth.uid()
        AND peer.user_id = profiles.id
    )
  );
