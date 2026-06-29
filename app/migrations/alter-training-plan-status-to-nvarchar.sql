-- ============================================
-- Migration: Change TrainingPlan status column from bit to nvarchar(20)
-- Run this script on your database to update the schema
-- ============================================

USE [TNIP_NEW_update]
GO

-- Step 1: Drop default constraint if it exists
IF OBJECT_ID('DF_TrainingPlan_status', 'D') IS NOT NULL
BEGIN
    ALTER TABLE dbo.TrainingPlan DROP CONSTRAINT DF_TrainingPlan_status;
    PRINT 'Dropped existing default constraint';
END
GO

-- Step 2: Update existing values to string equivalents
-- bit 1 (true) -> 'Pending'
-- bit 0 (false) -> 'Rejected'
UPDATE dbo.TrainingPlan SET status = 'Pending' WHERE status = 1;
UPDATE dbo.TrainingPlan SET status = 'Rejected' WHERE status = 0;
PRINT 'Updated existing values';
GO

-- Step 3: Drop the status column
ALTER TABLE dbo.TrainingPlan DROP COLUMN status;
PRINT 'Dropped status column';
GO

-- Step 4: Add new nvarchar(20) status column with default
ALTER TABLE dbo.TrainingPlan ADD status NVARCHAR(20) NOT NULL DEFAULT 'Pending' WITH VALUES;
PRINT 'Added new status column as nvarchar(20)';
GO

-- Step 5: Verify the change
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'TrainingPlan' AND COLUMN_NAME = 'status';
PRINT 'Schema verified successfully!';
GO
