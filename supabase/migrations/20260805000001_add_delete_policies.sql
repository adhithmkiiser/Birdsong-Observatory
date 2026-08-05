-- Migration: Add DELETE policies to detection tables for admin console

-- 1. Lantana Detections
CREATE POLICY "Allow public delete on lantana_detections" ON public.lantana_detections FOR DELETE USING (true);

-- 2. PAM Detections
CREATE POLICY "Allow public delete on pam_detections" ON public.pam_detections FOR DELETE USING (true);

-- 3. Live Detections
CREATE POLICY "Allow public delete on live_detections" ON public.live_detections FOR DELETE USING (true);
