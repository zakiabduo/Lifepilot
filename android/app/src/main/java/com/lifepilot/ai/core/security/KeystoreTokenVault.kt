package com.lifepilot.ai.core.security

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KeystoreTokenVault @Inject constructor(
    @ApplicationContext context: Context
) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "lifepilot_secure_session",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveIdToken(token: String) {
        prefs.edit().putString(KEY_FIREBASE_ID_TOKEN, token).apply()
    }

    fun readIdToken(): String? = prefs.getString(KEY_FIREBASE_ID_TOKEN, null)

    fun clearSession() {
        prefs.edit().remove(KEY_FIREBASE_ID_TOKEN).apply()
    }

    private companion object {
        const val KEY_FIREBASE_ID_TOKEN = "firebase_id_token"
    }
}

class FirebaseAuthInterceptor @Inject constructor(
    private val tokenVault: KeystoreTokenVault
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenVault.readIdToken()
        val request = chain.request().newBuilder().apply {
            if (!token.isNullOrBlank()) {
                header("Authorization", "Bearer $token")
            }
        }.build()
        return chain.proceed(request)
    }
}
