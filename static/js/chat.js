function uploadSelectedFile(input){
  if(!input.files || !input.files[0]) return;
  const file = input.files[0];

  const progressWrap = document.getElementById("uploadStatusContainer");
  const progressBar = document.getElementById("uploadProgressBar");
  const progressText = document.getElementById("uploadPercentage");
  const nameLabel = document.getElementById("uploadFileName");

  // Show the progress bar UI
  if (nameLabel) nameLabel.textContent = `Uploading ${file.name}...`;
  if (progressBar) progressBar.value = 0;
  if (progressText) progressText.textContent = "0%";
  if (progressWrap) progressWrap.style.display = "block";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("token", authToken);
  formData.append("room_id", currentRoom);
  formData.append("guest_user", getActiveRoomAlias());
  formData.append("client_id", myClientId);
  if (activeReply) {
    formData.append("reply_to_id", activeReply.id);
    formData.append("reply_to_sender", activeReply.sender);
    formData.append("reply_to_text", activeReply.text);
  }
  input.value = "";

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload");

  // Track live upload progress
  xhr.upload.onprogress = function(event) {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);
      if (progressBar) progressBar.value = percent;
      if (progressText) progressText.textContent = `${percent}%`;
    }
  };

  // Upload complete
  xhr.onload = function() {
    if (progressWrap) progressWrap.style.display = "none";
    if (xhr.status >= 200 && xhr.status < 300) {
      cancelReply();
    } else {
      showToast("Upload rejected (100MB max limit)", "❌");
    }
  };

  // Handle errors
  xhr.onerror = function() {
    if (progressWrap) progressWrap.style.display = "none";
    showToast("Upload failed", "❌");
  };

  xhr.send(formData);
}
