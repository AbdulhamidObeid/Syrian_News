#target illustrator

var sourceFolder = new Folder("/Users/obeid/Desktop/Antigravity-Hub/Projects/Syrian_News/Creatives/Designs/Templates");
var destFolder = new Folder("/Users/obeid/Desktop/Antigravity-Hub/Projects/Syrian_News/Creatives/Designs/BGs");

if (!destFolder.exists) {
    destFolder.create();
}

var files = sourceFolder.getFiles("*.ai");

for (var i = 0; i < files.length; i++) {
    var sourceDoc = app.open(files[i]);
    
    var baseName = files[i].name.split('.')[0];
    var destFile = new File(destFolder.fsName + "/" + baseName + ".jpg");
    
    var exportOptions = new ExportOptionsJPEG();
    exportOptions.antiAliasing = true;
    exportOptions.qualitySetting = 100;
    exportOptions.artBoardClipping = true;
    
    // We export artboard 1. If there's only 1 artboard, it's fine.
    sourceDoc.exportFile(destFile, ExportType.JPEG, exportOptions);
    
    sourceDoc.close(SaveOptions.DONOTSAVECHANGES);
}
