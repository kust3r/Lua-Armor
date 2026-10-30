ALTER POLICY "Users can view all profiles"
ON public.profiles
TO authenticated
USING (auth.uid() = user_id);
ALTER POLICY "Users can view all profiles"
ON public.profiles
RENAME TO "Users can view their own profile";