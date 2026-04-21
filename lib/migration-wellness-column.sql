-- Add wellness_data JSONB column to activity_logs table
ALTER TABLE activity_logs ADD COLUMN wellness_data JSONB DEFAULT NULL;
