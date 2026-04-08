package com.example.hardwarescanner

import android.app.Activity
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.SystemClock
import androidx.constraintlayout.widget.ConstraintLayout
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

class GpuBenchmarkEngine(
    private val activity: Activity,
    private val container: ConstraintLayout
) {

    private val renderer = BenchmarkRenderer()
    private val glSurfaceView = GLSurfaceView(activity)

    @Volatile
    private var initialized = false

    private var lastSampleFrames: Long = 0
    private var lastSampleMs: Long = SystemClock.elapsedRealtime()

    init {
        glSurfaceView.setEGLContextClientVersion(2)
        glSurfaceView.setRenderer(renderer)
        glSurfaceView.renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        glSurfaceView.alpha = 0.01f
    }

    fun start() {
        if (initialized) return

        val params = ConstraintLayout.LayoutParams(1, 1)
        params.topToTop = ConstraintLayout.LayoutParams.PARENT_ID
        params.startToStart = ConstraintLayout.LayoutParams.PARENT_ID

        container.addView(glSurfaceView, params)
        initialized = true
    }

    fun onResume() {
        if (initialized) {
            glSurfaceView.onResume()
        }
    }

    fun onPause() {
        if (initialized) {
            glSurfaceView.onPause()
        }
    }

    fun startBenchmark() {
        renderer.benchmarkEnabled.set(1)
        if (initialized) {
            glSurfaceView.renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        }
    }

    fun stopBenchmark() {
        renderer.benchmarkEnabled.set(0)
        if (initialized) {
            glSurfaceView.renderMode = GLSurfaceView.RENDERMODE_WHEN_DIRTY
            glSurfaceView.requestRender()
        }
    }

    fun setStressLevel(level: Int) {
        renderer.stressLevel.set(level.coerceIn(0, 100))
    }

    fun getGpuInfo(): GpuStaticInfo = renderer.staticInfo

    fun sampleLiveStats(): GpuLiveStats {
        val nowMs = SystemClock.elapsedRealtime()
        val frameCount = renderer.frameCounter.get()

        val elapsedMs = (nowMs - lastSampleMs).coerceAtLeast(1)
        val frameDiff = (frameCount - lastSampleFrames).coerceAtLeast(0)

        lastSampleMs = nowMs
        lastSampleFrames = frameCount

        val fps = (frameDiff.toDouble() * 1000.0) / elapsedMs.toDouble()
        val frameTimeMs = if (fps > 0.0) 1000.0 / fps else 0.0
        val estimatedLoad = ((frameTimeMs / 16.67) * 100.0).coerceIn(0.0, 100.0)

        return GpuLiveStats(
            fps = String.format(Locale.US, "%.1f fps", fps),
            frameTimeMs = String.format(Locale.US, "%.2f ms", frameTimeMs),
            estimatedLoad = String.format(Locale.US, "%.0f%%", estimatedLoad),
            estimatedLoadPercent = estimatedLoad.toFloat()
        )
    }

    private class BenchmarkRenderer : GLSurfaceView.Renderer {

        val frameCounter = AtomicLong(0)
        val stressLevel = AtomicInteger(50)
        val benchmarkEnabled = AtomicInteger(1)

        @Volatile
        var staticInfo: GpuStaticInfo = GpuStaticInfo()

        override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
            staticInfo = GpuStaticInfo(
                renderer = GLES20.glGetString(GLES20.GL_RENDERER) ?: "Unknown",
                vendor = GLES20.glGetString(GLES20.GL_VENDOR) ?: "Unknown",
                version = GLES20.glGetString(GLES20.GL_VERSION) ?: "Unknown",
                glslVersion = GLES20.glGetString(GLES20.GL_SHADING_LANGUAGE_VERSION) ?: "Unknown"
            )
        }

        override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
            GLES20.glViewport(0, 0, width, height)
        }

        override fun onDrawFrame(gl: GL10?) {
            val hue = (frameCounter.get() % 300L) / 300f
            GLES20.glClearColor(hue, 0.2f, 0.3f, 1.0f)
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)

            if (benchmarkEnabled.get() == 1) {
                // Artificial GPU work scaled by slider value.
                val loops = 5_000 + (stressLevel.get() * 500)
                var sink = 0f
                for (i in 0 until loops) {
                    sink += kotlin.math.sin((i + hue).toDouble()).toFloat()
                }
                if (sink > 1_000_000f) {
                    GLES20.glClearColor(0f, 0f, 0f, 1f)
                }
            }

            frameCounter.incrementAndGet()
        }
    }
}

data class GpuStaticInfo(
    val renderer: String = "Initializing...",
    val vendor: String = "Initializing...",
    val version: String = "Initializing...",
    val glslVersion: String = "Initializing..."
)

data class GpuLiveStats(
    val fps: String,
    val frameTimeMs: String,
    val estimatedLoad: String,
    val estimatedLoadPercent: Float
)
