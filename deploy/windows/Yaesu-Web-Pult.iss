; Inno Setup script for Yaesu Web Pult (Windows x64).
; Build: ISCC.exe deploy\windows\Yaesu-Web-Pult.iss /DMyAppVersion=3.2-preview
; The application directory (distdir\Yaesu-Web-Pult) must already contain
; the onedir PyInstaller build, tools\hamlib and tools\rtlsdr.

#ifndef MyAppVersion
  #define MyAppVersion "3.2-preview"
#endif
#ifndef PrivMode
  #define PrivMode "admin"
#endif
#define MyAppName "Yaesu Web Pult"
#define MyAppPublisher "Evgeny161rus"
#define MyAppURL "https://github.com/Evgeny161rus/yaesu-web-pult"
#define MyAppExeName "Yaesu-Web-Pult.exe"
#ifndef AppSource
  #define AppSource "distdir\Yaesu-Web-Pult"
#endif

[Setup]
AppId={{B413ECF3-AE5A-4129-A248-D8E4D1377C33}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired={#PrivMode}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\..\dist
OutputBaseFilename=Yaesu-Web-Pult-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupIconFile=web\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
LicenseFile=LICENSE
CloseApplications=yes
RestartApplications=no
VersionInfoVersion=3.2.0.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} setup
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion=3.2.0.0
SourceDir=..\..\

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Создать ярлык на рабочем столе"; GroupDescription: "Дополнительно:"
Name: "drivers"; Description: "Установить драйверы FTDI и Silicon Labs CP210x"; GroupDescription: "Драйверы:"

[Files]
; Application (onedir PyInstaller build, including tools\hamlib and tools\rtlsdr).
Source: "{#AppSource}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; \
    Excludes: "config.json,cert.pem,key.pem,records\*,voice\*,sstv\*,fax\*,memory\*,ft8_log.adi,ftx1-pult.log*,__pycache__\*,*.pyc"
; Bundled USB drivers and the driver installer.
Source: "drivers\*"; DestDir: "{app}\drivers"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Драйверы\RTL-SDR (Zadig)"; Filename: "{app}\drivers\rtlsdr\zadig-2.9.exe"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; The application lives in Program Files, but writes config.json/cert.pem/records
; next to the EXE. Give local users Modify on the install folder (the app is a
; desktop ham tool, not a multi-user service).
Filename: "{sys}\icacls.exe"; Parameters: """{app}"" /grant *S-1-5-32-545:(OI)(CI)M /T /C /Q"; \
    Flags: runhidden waituntilterminated; StatusMsg: "Настройка прав на папку программы..."
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\drivers\install-drivers.ps1"""; \
    Flags: runhidden waituntilterminated; Tasks: drivers; StatusMsg: "Установка драйверов FTDI и CP210x..."
Filename: "{app}\{#MyAppExeName}"; Description: "Запустить {#MyAppName}"; \
    Flags: nowait postinstall skipifsilent runascurrentuser
