package com.lifepilot.ai.core.database

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "tasks")
data class TaskEntity(
    @PrimaryKey val id: String,
    val title: String,
    val description: String,
    val priority: String,
    val dueDate: String,
    val status: String,
    val estimatedMinutes: Int,
    val bestTimeWindow: String,
    val pendingSync: Boolean,
    val updatedAtIso: String
)

@Entity(tableName = "offline_mutations")
data class OfflineMutationEntity(
    @PrimaryKey val id: String,
    val kind: String,
    val payloadJson: String,
    val queuedAtIso: String
)

@Dao
interface TaskDao {
    @Query("SELECT * FROM tasks ORDER BY dueDate ASC")
    fun observeTasks(): Flow<List<TaskEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(tasks: List<TaskEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(task: TaskEntity)
}

@Dao
interface OfflineMutationDao {
    @Query("SELECT * FROM offline_mutations ORDER BY queuedAtIso ASC")
    suspend fun listPending(): List<OfflineMutationEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueue(mutation: OfflineMutationEntity)

    @Query("DELETE FROM offline_mutations WHERE id IN (:ids)")
    suspend fun deleteSynced(ids: List<String>)
}

@Database(
    entities = [TaskEntity::class, OfflineMutationEntity::class],
    version = 1,
    exportSchema = true
)
abstract class LifePilotDatabase : RoomDatabase() {
    abstract fun taskDao(): TaskDao
    abstract fun offlineMutationDao(): OfflineMutationDao
}
