import React, { useMemo, useState } from "react";
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import Avatar from "@/components/ui/Avatar";
import { deleteAvatarByUrl, uploadAvatarFromUri } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

type ProfileAvatarPickerProps = {
  userId: string;
  currentUrl?: string | null;
  onChanged: (url: string | null) => void;
};

export default function ProfileAvatarPicker({
  userId,
  currentUrl,
  onChanged,
}: ProfileAvatarPickerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const displayUrl = useMemo(() => currentUrl ?? undefined, [currentUrl]);

  const openSheet = () => {
    setErrorMessage(null);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            "Cancel",
            "Take photo",
            "Choose from library",
            currentUrl ? "Remove photo" : undefined,
          ].filter(Boolean) as string[],
          cancelButtonIndex: 0,
          userInterfaceStyle: "dark",
        },
        async (buttonIndex) => {
          // Cancel
          if (buttonIndex === 0) return;
          // iOS mapping: 1 -> Take photo, 2 -> Choose, 3 -> Remove (if exists)
          if (buttonIndex === 1) {
            await handlePick("camera");
          } else if (buttonIndex === 2) {
            await handlePick("library");
          } else if (buttonIndex === 3 && currentUrl) {
            await handleRemove();
          }
        }
      );
    } else {
      setSheetOpen(true);
    }
  };

  const closeSheet = () => setSheetOpen(false);

  const handlePick = async (source: "camera" | "library") => {
    try {
      setErrorMessage(null);
      let permissionGranted = false;
      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        permissionGranted = status === ImagePicker.PermissionStatus.GRANTED;
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        permissionGranted = status === ImagePicker.PermissionStatus.GRANTED;
      }
      if (!permissionGranted) {
        setErrorMessage("Permission denied.");
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.9,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: false,
              quality: 0.9,
            });

      if (result.canceled) {
        return;
      }
      const picked = result.assets?.[0];
      if (!picked?.uri) {
        setErrorMessage("No image selected.");
        return;
      }

      // Center-crop to square and resize to ~512
      const size = Math.min(picked.width ?? 512, picked.height ?? 512);
      const manip = await ImageManipulator.manipulateAsync(
        picked.uri,
        [
          { crop: { originX: 0, originY: 0, width: size, height: size } },
          { resize: { width: 512, height: 512 } },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      setUploading(true);
      if (Platform.OS !== "ios") closeSheet();
      // Best-effort: delete old first to avoid orphans
      try {
        if (currentUrl) {
          await deleteAvatarByUrl(currentUrl);
        }
      } catch {
        // ignore cleanup errors
      }
      const { publicUrl } = await uploadAvatarFromUri(manip.uri, userId);
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      onChanged(publicUrl);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message ?? "Failed to upload avatar.");
      if (Platform.OS !== "ios") setSheetOpen(true);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentUrl) {
      if (Platform.OS !== "ios") closeSheet();
      return;
    }
    try {
      setErrorMessage(null);
      setUploading(true);
      if (Platform.OS !== "ios") closeSheet();
      try {
        await deleteAvatarByUrl(currentUrl);
      } catch {
        // ignore cleanup errors
      }
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      onChanged(null);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message ?? "Failed to remove avatar.");
      if (Platform.OS !== "ios") setSheetOpen(true);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <Avatar uri={displayUrl} size={88} />
        {uploading && (
          <View style={styles.overlay}>
            <ActivityIndicator color="#20e5e5" />
          </View>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          onPress={openSheet}
          activeOpacity={0.9}
          style={styles.editFab}
        >
          <Text style={styles.editFabText}>✎</Text>
        </TouchableOpacity>
      </View>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {/* Android/custom bottom sheet */}
      <Modal
        visible={sheetOpen}
        animationType="slide"
        transparent
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.backdrop} onPress={closeSheet} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Change avatar</Text>
          <Pressable style={styles.sheetButton} onPress={() => handlePick("camera")}>
            <Text style={styles.sheetButtonText}>Take photo</Text>
          </Pressable>
          <Pressable
            style={styles.sheetButton}
            onPress={() => handlePick("library")}
          >
            <Text style={styles.sheetButtonText}>Choose from library</Text>
          </Pressable>
          {currentUrl ? (
            <Pressable style={styles.sheetButton} onPress={handleRemove}>
              <Text style={[styles.sheetButtonText, { color: "#fda4af" }]}>
                Remove photo
              </Text>
            </Pressable>
          ) : null}
          <Pressable style={[styles.sheetButton, styles.cancel]} onPress={closeSheet}>
            <Text style={[styles.sheetButtonText, styles.cancelText]}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", marginBottom: 12 },
  avatarContainer: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  editFab: {
    position: "absolute",
    bottom: 0,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#20e5e5",
    shadowColor: "#20e5e5",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  editFabText: { color: "#06121a", fontWeight: "900" },
  error: { marginTop: 8, color: "#fda4af", fontSize: 12 },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#0f1720",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetTitle: {
    color: "#e6f0f2",
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 8,
  },
  sheetButton: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sheetButtonText: { color: "#e6f0f2", fontWeight: "700" },
  cancel: { marginTop: 8, borderTopWidth: 0 },
  cancelText: { color: "#94a3b8", fontWeight: "700" },
});


