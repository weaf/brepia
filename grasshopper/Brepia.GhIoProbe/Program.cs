using GH_IO;
using GH_IO.Serialization;

if (args.Length != 1)
{
    Console.Error.WriteLine("Usage: Brepia.GhIoProbe <output.ghx>");
    return 2;
}

var outputPath = Path.GetFullPath(args[0]);
var expected = new ProbePayload("cabinetA42", "revision-42");
var archive = new GH_Archive();
if (!archive.AppendObject(expected, "BrepiaProbe"))
{
    Console.Error.WriteLine("Could not append GH_IO probe payload.");
    return 1;
}

// Probe GH_IO's XML archive codec only. The binary codec references
// System.Drawing.Common and the file convenience APIs also pull desktop UI
// assemblies. XML keeps this capability check focused on portable archive
// structure rather than Rhino/Grasshopper hosting or desktop dependencies.
var xml = archive.Serialize_Xml();
if (string.IsNullOrWhiteSpace(xml))
{
    Console.Error.WriteLine("GH_IO produced an empty XML archive.");
    return 1;
}
File.WriteAllText(outputPath, xml);

var persisted = File.ReadAllText(outputPath);
var readBack = new GH_Archive();
if (!readBack.Deserialize_Xml(persisted))
{
    Console.Error.WriteLine("Could not deserialize GH_IO XML probe archive.");
    return 1;
}
var actual = new ProbePayload();
if (!readBack.ExtractObject(actual, "BrepiaProbe") ||
    actual.ProjectId != expected.ProjectId ||
    actual.SourceRevisionId != expected.SourceRevisionId)
{
    Console.Error.WriteLine("GH_IO XML probe archive identity did not round-trip.");
    return 1;
}

Console.WriteLine(
    $"GH_IO standalone XML round-trip PASS: {actual.ProjectId} {actual.SourceRevisionId} {new FileInfo(outputPath).Length} bytes");
return 0;

sealed class ProbePayload : GH_ISerializable
{
    public ProbePayload()
    {
    }

    public ProbePayload(string projectId, string sourceRevisionId)
    {
        ProjectId = projectId;
        SourceRevisionId = sourceRevisionId;
    }

    public string ProjectId { get; private set; } = string.Empty;
    public string SourceRevisionId { get; private set; } = string.Empty;

    public bool Write(GH_IWriter writer)
    {
        writer.SetString("projectId", ProjectId);
        writer.SetString("sourceRevisionId", SourceRevisionId);
        return true;
    }

    public bool Read(GH_IReader reader)
    {
        ProjectId = reader.GetString("projectId");
        SourceRevisionId = reader.GetString("sourceRevisionId");
        return true;
    }
}
