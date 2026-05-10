require 'xcodeproj'

project_path = '/Users/besirunlu/mathico/mathico/ios/mathico.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the DeviceActivityMonitor target
ext_target = project.targets.find { |t| t.name == 'DeviceActivityMonitor' }
raise "DeviceActivityMonitor target not found!" unless ext_target

puts "Found target: #{ext_target.name}"

# Find the DeviceActivityMonitor group
ext_group = project.main_group.find_subpath('DeviceActivityMonitor', false)
raise "DeviceActivityMonitor group not found!" unless ext_group

puts "Found group: #{ext_group.display_name}"
puts "Group children: #{ext_group.children.map(&:display_name).join(', ')}"

# Check if ScreenTimeSharedStore is already in the group
already_has_store = ext_group.children.any? { |c| c.display_name == 'ScreenTimeSharedStore.swift' }

unless already_has_store
  # Add ScreenTimeSharedStore.swift reference to the group
  shared_store_path = '../mathico/ScreenTimeSharedStore.swift'
  file_ref = ext_group.new_reference(shared_store_path)
  file_ref.source_tree = 'SOURCE_ROOT'
  file_ref.path = 'mathico/ScreenTimeSharedStore.swift'
  puts "Added file reference for ScreenTimeSharedStore.swift"

  # Add to extension target's compile sources
  ext_target.source_build_phase.add_file_reference(file_ref)
  puts "Added to DeviceActivityMonitor compile sources"
else
  puts "ScreenTimeSharedStore.swift already in group"
end

project.save
puts "Project saved successfully"
