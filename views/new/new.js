function newFile(selected) {
    if (selected.value == ".newfile.") {
        document.getElementById("Upload").style.display = "block";
    } else {
        document.getElementById("Upload").style.display = "none";
    }
}
if (currentFiles == "") {
    document.getElementById("Upload").style.display = "block";
} else {
    document.getElementById("Upload").style.display = "none";
} 