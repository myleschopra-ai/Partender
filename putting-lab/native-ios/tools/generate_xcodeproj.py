"""Generate an ordinary, self-contained Xcode app project, with no third-party dependencies.
Run from the release root: python tools/generate_xcodeproj.py
"""
from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]
sources=sorted((root/'iOS'/'PuttingLabNative').glob('*.swift'))
proj=root/'iOS'/'PuttingLabNative.xcodeproj'
proj.mkdir(exist_ok=True)
uid=lambda kind,name: hashlib.sha256((kind+':'+name).encode()).hexdigest().upper()[:24]
PROJECT=uid('project','puttinglab')
TARGET=uid('target','puttinglab')
MAIN_GROUP=uid('group','main')
SOURCES_GROUP=uid('group','sources')
PRODUCTS_GROUP=uid('group','products')
SOURCES_PHASE=uid('phase','sources')
FRAMEWORK_PHASE=uid('phase','frameworks')
RESOURCES_PHASE=uid('phase','resources')
PROJECT_CONFIG=uid('configlist','project')
TARGET_CONFIG=uid('configlist','target')
PRODUCT=uid('product','app')
entries=[]
add=entries.append
add('/* Begin PBXBuildFile section */')
for file in sources:add(f'{uid("build",file.name)} /* {file.name} in Sources */ = {{isa = PBXBuildFile; fileRef = {uid("file",file.name)} /* {file.name} */; }};')
add('/* End PBXBuildFile section */\n/* Begin PBXFileReference section */')
for file in sources:add(f'{uid("file",file.name)} /* {file.name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {file.name}; sourceTree = "<group>"; }};')
add(f'{PRODUCT} /* PuttingLabNative.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = PuttingLabNative.app; sourceTree = BUILT_PRODUCTS_DIR; }};')
add('/* End PBXFileReference section */\n/* Begin PBXGroup section */')
add(f'{MAIN_GROUP} = {{isa = PBXGroup; children = ({SOURCES_GROUP} /* PuttingLabNative */, {PRODUCTS_GROUP} /* Products */, ); sourceTree = "<group>"; }};')
add(f'{SOURCES_GROUP} /* PuttingLabNative */ = {{isa = PBXGroup; children = ({", ".join(uid("file",p.name)+" /* "+p.name+" */" for p in sources)}, ); path = PuttingLabNative; sourceTree = "<group>"; }};')
add(f'{PRODUCTS_GROUP} /* Products */ = {{isa = PBXGroup; children = ({PRODUCT} /* PuttingLabNative.app */, ); name = Products; sourceTree = "<group>"; }};')
add('/* End PBXGroup section */\n/* Begin PBXNativeTarget section */')
add(f'{TARGET} /* PuttingLabNative */ = {{isa = PBXNativeTarget; buildConfigurationList = {TARGET_CONFIG}; buildPhases = ({SOURCES_PHASE} /* Sources */, {FRAMEWORK_PHASE} /* Frameworks */, {RESOURCES_PHASE} /* Resources */, ); buildRules = (); dependencies = (); name = PuttingLabNative; productName = PuttingLabNative; productReference = {PRODUCT} /* PuttingLabNative.app */; productType = "com.apple.product-type.application"; }};')
add('/* End PBXNativeTarget section */\n/* Begin PBXProject section */')
add(f'{PROJECT} /* Project object */ = {{isa = PBXProject; attributes = {{BuildIndependentTargetsInParallel = 1; LastUpgradeCheck = 1600; TargetAttributes = {{{TARGET} = {{CreatedOnToolsVersion = 16.0;}}; }}; }}; buildConfigurationList = {PROJECT_CONFIG}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en, Base); mainGroup = {MAIN_GROUP}; productRefGroup = {PRODUCTS_GROUP}; projectDirPath = ""; projectRoot = ""; targets = ({TARGET} /* PuttingLabNative */, ); }};')
add('/* End PBXProject section */\n/* Begin PBXSourcesBuildPhase section */')
add(f'{SOURCES_PHASE} /* Sources */ = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({", ".join(uid("build",p.name)+" /* "+p.name+" in Sources */" for p in sources)}, ); runOnlyForDeploymentPostprocessing = 0; }};')
add('/* End PBXSourcesBuildPhase section */\n/* Begin PBXFrameworksBuildPhase section */')
add(f'{FRAMEWORK_PHASE} /* Frameworks */ = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};')
add('/* End PBXFrameworksBuildPhase section */\n/* Begin PBXResourcesBuildPhase section */')
add(f'{RESOURCES_PHASE} /* Resources */ = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};')
add('/* End PBXResourcesBuildPhase section */\n/* Begin XCBuildConfiguration section */')
configs=[]
for who in ['project','target']:
 for mode in ['Debug','Release']:
  conf=uid('config',who+mode)
  if who=='project':settings=f'ALWAYS_SEARCH_USER_PATHS = NO; CLANG_ENABLE_MODULES = YES; SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SWIFT_VERSION = 5.0; SWIFT_STRICT_CONCURRENCY = minimal; GCC_OPTIMIZATION_LEVEL = {"0" if mode=="Debug" else "s"}; ENABLE_TESTABILITY = {"YES" if mode=="Debug" else "NO"};'
  else:settings='GENERATE_INFOPLIST_FILE = YES; INFOPLIST_KEY_NSCameraUsageDescription = "Camera frames are analyzed locally to detect putting stroke candidates and generate review clips."; INFOPLIST_KEY_UIFileSharingEnabled = YES; INFOPLIST_KEY_LSSupportsOpeningDocumentsInPlace = YES; INFOPLIST_KEY_UIApplicationSupportsDocumentBrowser = NO; INFOPLIST_KEY_UILaunchScreen_Generation = YES; PRODUCT_BUNDLE_IDENTIFIER = com.myleschopra.puttinglabnative; PRODUCT_NAME = "$(TARGET_NAME)"; TARGETED_DEVICE_FAMILY = "1"; CODE_SIGN_STYLE = Automatic; SWIFT_VERSION = 5.0;'
  add(f'{conf} /* {mode} ({who}) */ = {{isa = XCBuildConfiguration; buildSettings = {{{settings}}}; name = {mode}; }};')
add('/* End XCBuildConfiguration section */\n/* Begin XCConfigurationList section */')
for who,cfg in [('project',PROJECT_CONFIG),('target',TARGET_CONFIG)]:
 add(f'{cfg} = {{isa = XCConfigurationList; buildConfigurations = ({uid("config",who+"Debug")}, {uid("config",who+"Release")}, ); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};')
add('/* End XCConfigurationList section */')
project=f'''// !$*UTF8*$!\n{{\narchiveVersion = 1;\nclasses = {{}};\nobjectVersion = 56;\nobjects = {{\n{chr(10).join(entries)}\n}};\nrootObject = {PROJECT};\n}}\n'''
(proj/'project.pbxproj').write_text(project)
print('Wrote '+str(proj/'project.pbxproj')+' for '+str(len(sources))+' Swift sources')
