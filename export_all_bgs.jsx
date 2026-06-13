#target illustrator

var doc = app.activeDocument;
var destFolder = new Folder("/Users/obeid/Desktop/Antigravity-Hub/Projects/Syrian_News/Assets/BGs");

if (!destFolder.exists) {
    destFolder.create();
}

var exportOptions = new ExportOptionsJPEG();
exportOptions.antiAliasing = true;
exportOptions.qualitySetting = 100;
exportOptions.artBoardClipping = true;

for (var i = 0; i < doc.artboards.length; i++) {
    var ab = doc.artboards[i];
    var abName = ab.name;
    
    // Set the active artboard
    doc.artboards.setActiveArtboardIndex(i);
    
    var destFile = new File(destFolder.fsName + "/" + abName + ".jpg");
    doc.exportFile(destFile, ExportType.JPEG, exportOptions);
}
