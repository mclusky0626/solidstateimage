package com.solidstateimage.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "NativeSave")
public class NativeSavePlugin extends Plugin {
    @PluginMethod
    public void saveImage(PluginCall call) {
        String url = call.getString("url");
        String name = call.getString("name", "image.jpg");

        if (url == null || url.isEmpty()) {
            call.reject("NO_URL");
            return;
        }

        getBridge().execute(() -> {
            try {
                SaveResult result = saveImageToGallery(url, safeFileName(name));
                JSObject ret = new JSObject();
                ret.put("uri", result.uri);
                ret.put("name", result.name);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage(), e);
            }
        });
    }

    private SaveResult saveImageToGallery(String urlString, String displayName) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(urlString).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(60000);
        connection.connect();

        int code = connection.getResponseCode();
        if (code < 200 || code >= 300) {
            throw new Exception("이미지를 가져오지 못했습니다 (" + code + ")");
        }

        String mimeType = connection.getContentType();
        if (mimeType == null || !mimeType.startsWith("image/")) {
            mimeType = mimeTypeForName(displayName);
        }

        try (InputStream input = connection.getInputStream()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return saveWithMediaStore(input, displayName, mimeType);
            }
            return saveLegacy(input, displayName);
        } finally {
            connection.disconnect();
        }
    }

    private SaveResult saveWithMediaStore(InputStream input, String displayName, String mimeType) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, displayName);
        values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/SolidStateImage");
        values.put(MediaStore.Images.Media.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new Exception("갤러리 저장 위치를 만들지 못했습니다.");

        try (OutputStream output = resolver.openOutputStream(uri)) {
            if (output == null) throw new Exception("갤러리 파일을 열지 못했습니다.");
            copy(input, output);
        } catch (Exception e) {
            resolver.delete(uri, null, null);
            throw e;
        }

        values.clear();
        values.put(MediaStore.Images.Media.IS_PENDING, 0);
        resolver.update(uri, values, null, null);
        return new SaveResult(uri.toString(), displayName);
    }

    private SaveResult saveLegacy(InputStream input, String displayName) throws Exception {
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "SolidStateImage");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("저장 폴더를 만들지 못했습니다.");

        File file = uniqueFile(dir, displayName);
        try (OutputStream output = new FileOutputStream(file)) {
            copy(input, output);
        }
        MediaScannerConnection.scanFile(getContext(), new String[] { file.getAbsolutePath() }, null, null);
        return new SaveResult(Uri.fromFile(file).toString(), file.getName());
    }

    private void copy(InputStream input, OutputStream output) throws Exception {
        byte[] buffer = new byte[1024 * 64];
        int read;
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
    }

    private String safeFileName(String name) {
        String cleaned = name.replaceAll("[\\\\/:*?\"<>|#%{}^~\\[\\]`]", "_").trim();
        if (cleaned.isEmpty()) cleaned = "image.jpg";
        if (!cleaned.contains(".")) cleaned = cleaned + ".jpg";
        return cleaned;
    }

    private String mimeTypeForName(String name) {
        String lower = name.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".heic")) return "image/heic";
        if (lower.endsWith(".heif")) return "image/heif";
        return "image/jpeg";
    }

    private File uniqueFile(File dir, String displayName) {
        File file = new File(dir, displayName);
        if (!file.exists()) return file;

        int dot = displayName.lastIndexOf('.');
        String base = dot > 0 ? displayName.substring(0, dot) : displayName;
        String ext = dot > 0 ? displayName.substring(dot) : "";
        int i = 1;
        while (file.exists()) {
            file = new File(dir, base + " (" + i + ")" + ext);
            i += 1;
        }
        return file;
    }

    private static class SaveResult {
        final String uri;
        final String name;

        SaveResult(String uri, String name) {
            this.uri = uri;
            this.name = name;
        }
    }
}
