using System.Text.Json;
using Brepia.Grasshopper.Packaging;

if (args.Length != 2)
{
    Console.Error.WriteLine(
        "Usage: Brepia.Grasshopper.Packager <contract.brepia-grasshopper.json> <output.gh>");
    return 2;
}

try
{
    var contractJson = File.ReadAllText(args[0]);
    var result = BrepiaGrasshopperDocumentPackager.Write(contractJson, args[1]);
    Console.WriteLine(JsonSerializer.Serialize(new
    {
        kind = "brepia-grasshopper-package-result",
        schemaVersion = 1,
        result.ProjectId,
        result.SourceRevisionId,
        componentInstanceId = result.ComponentInstanceId,
        result.ByteLength,
        result.OutputPath,
    }));
    return 0;
}
catch (Exception error)
{
    Console.Error.WriteLine(error.ToString());
    return 1;
}
