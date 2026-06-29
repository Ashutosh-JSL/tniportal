-- Migration: Fix status column data type in TrainingPlan table
-- Description: Change status from bit to nvarchar(20)

USE [TNIP_NEW_update]
GO

-- Drop the default constraint first if it exists
IF OBJECT_ID('DF_TrainingPlan_status', 'D') IS NOT NULL
BEGIN
    ALTER TABLE dbo.TrainingPlan DROP CONSTRAINT DF_TrainingPlan_status
END
GO

-- Check if status column exists as bit type and needs to be converted
IF COL_LENGTH('dbo.TrainingPlan', 'status') IS NOT NULL
BEGIN
    -- Get the current data type
    DECLARE @currentType NVARCHAR(20)
    SELECT @currentType = ty.name
    FROM sys.columns c
    JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.TrainingPlan') AND c.name = 'status'

    -- If it's a bit type, convert to nvarchar(20)
    IF @currentType = 'bit'
    BEGIN
        PRINT 'Converting status column from bit to nvarchar(20)...'

        -- Update existing values: 1 -> 'Pending', 0 -> 'Rejected' (or keep as pending for now)
        UPDATE dbo.TrainingPlan SET status = 'Pending' WHERE status = 1
        UPDATE dbo.TrainingPlan SET status = 'Rejected' WHERE status = 0

        -- Alter the column to nvarchar(20)
        ALTER TABLE dbo.TrainingPlan DROP CONSTRAINT DF_TrainingPlan_status 2>/NULL
        ALTER TABLE dbo.TrainingPlan ADD status_tmp NVARCHAR(20) NULL

        -- Copy data (already done above, but just in case)
        UPDATE dbo.TrainingPlan SET status_tmp = status WHERE status IS NOT NULL

        -- Drop old column and rename new one
        ALTER TABLE dbo.TrainingPlan DROP COLUMN status
        EXEC sp_rename 'dbo.TrainingPlan.status_tmp', 'status', 'COLUMN'

        PRINT 'Status column converted successfully!'
    END
END

-- Add default constraint for pending
IF COL_LENGTH('dbo.TrainingPlan', 'status') IS NOT NULL
   AND OBJECT_ID('DF_TrainingPlan_status', 'D') IS NULL
BEGIN
    ALTER TABLE dbo.TrainingPlan ADD CONSTRAINT DF_TrainingPlan_status DEFAULT 'Pending' FOR status
END
