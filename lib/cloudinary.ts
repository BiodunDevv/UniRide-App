import * as ImagePicker from "expo-image-picker";

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export interface UploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
}

/**
 * Upload an image to Cloudinary
 */
export async function uploadToCloudinary(
  imageUri: string,
  folder: string = "uniride",
): Promise<UploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary configuration is missing");
  }

  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("file", {
    uri: imageUri,
    name: filename,
    type,
  } as any);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Upload failed");
  }

  return {
    secure_url: data.secure_url,
    public_id: data.public_id,
    width: data.width,
    height: data.height,
  };
}

/**
 * Pick an image from the gallery and upload to Cloudinary
 */
export async function pickAndUploadImage(
  folder: string = "uniride/profiles",
): Promise<UploadResult | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Camera roll permission is required");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) return null;

  return uploadToCloudinary(result.assets[0].uri, folder);
}

/**
 * Take a photo with camera and upload to Cloudinary
 */
export async function takeAndUploadPhoto(
  folder: string = "uniride/profiles",
): Promise<UploadResult | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Camera permission is required");
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) return null;

  return uploadToCloudinary(result.assets[0].uri, folder);
}
