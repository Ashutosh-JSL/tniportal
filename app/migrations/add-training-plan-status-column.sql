-- Migration: Add status column to TrainingPlan table
-- Description: Unifies TrainingPlan and TrainingPlanAuthorizationQueue into a single table

USE [TNIP_NEW_update]
GO

-- Add status column if not exists
IF COL_LENGTH('dbo.TrainingPlan', 'status') IS NULL
BEGIN
    ALTER TABLE dbo.TrainingPlan ADD status NVARCHAR(20) NOT NULL
        CONSTRAINT DF_TrainingPlan_status DEFAULT 'Pending'
        WITH VALUES
END
GO

-- Add reviewed_by columns for tracking approval history
IF COL_LENGTH('dbo.TrainingPlan', 'reviewed_by') IS NULL
BEGIN
    ALTER TABLE dbo.TrainingPlan ADD reviewed_by NVARCHAR(50) NULL
END
GO

IF COL_LENGTH('dbo.TrainingPlan', 'reviewed_at') IS NULL
BEGIN
    ALTER TABLE dbo.TrainingPlan ADD reviewed_at DATETIME NULL
END
GO

-- Update existing plans - mark those that were approved in the queue as Approved
UPDATE TP
SET status = 'Approved',
    reviewed_by = aq.reviewed_by,
    reviewed_at = aq.reviewed_at
FROM dbo.TrainingPlan TP
INNER JOIN dbo.TrainingPlanAuthorizationQueue aq ON TP.plan_id = aq.source_plan_id
WHERE aq.status IN ('Approved', 'Rejected')
