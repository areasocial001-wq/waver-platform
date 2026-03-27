
CREATE POLICY "Users can update their own status history"
ON public.api_status_history
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
