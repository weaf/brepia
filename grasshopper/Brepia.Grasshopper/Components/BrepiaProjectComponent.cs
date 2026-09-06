using Brepia.Grasshopper.Runtime;
using GH_IO.Serialization;
using Grasshopper.Kernel;

namespace Brepia.Grasshopper.Components;

public sealed class BrepiaProjectComponent : GH_Component
{
    private const string ContractArchiveKey = "brepia.contract.v1";
    private BrepiaGrasshopperContract? _contract;
    private string? _contractLoadError;

    public BrepiaProjectComponent()
        : base(
            "Brepia Project",
            "Brepia",
            "A Brepia-authored parametric project object. The embedded contract remains the canonical component payload.",
            "Brepia",
            "Project")
    {
    }

    public override Guid ComponentGuid =>
        new("56F4B72D-8972-4899-9522-0CDA8F59BB71");

    protected override System.Drawing.Bitmap? Icon => null;

    public BrepiaGrasshopperContract? Contract => _contract;

    /// <summary>
    /// Replaces the embedded canonical contract. Phase 7C adds the user-facing
    /// load/replace action and rebuilds dynamic input ports from stable IDs.
    /// </summary>
    public void LoadContractJson(string json)
    {
        var next = BrepiaGrasshopperContract.Parse(json);
        RecordUndoEvent("Load Brepia contract");
        _contract = next;
        _contractLoadError = null;
        NickName = next.ProjectName;
        ExpireSolution(recompute: true);
    }

    protected override void RegisterInputParams(GH_InputParamManager pManager)
    {
        // Phase 7C reconstructs one numeric input per stable Brepia parameter ID
        // followed by the standard Plane input. 7B deliberately does not expose
        // a file-path or JSON input that could become a second canonical state.
    }

    protected override void RegisterOutputParams(GH_OutputParamManager pManager)
    {
        pManager.AddBrepParameter("Result", "R", "Primary exact Brepia BRep.", GH_ParamAccess.item);
        pManager.AddBrepParameter("Footprint", "F", "Optional exact footprint BRep.", GH_ParamAccess.item);
        pManager.AddBrepParameter("Clearance", "C", "Optional exact clearance-envelope BRep.", GH_ParamAccess.item);
        pManager.AddBrepParameter("Maintenance", "M", "Optional exact maintenance-envelope BRep.", GH_ParamAccess.item);
        pManager.AddPointParameter("Connections", "CP", "Semantic connection points.", GH_ParamAccess.list);
        pManager.AddPointParameter("Mounting", "MP", "Semantic mounting points.", GH_ParamAccess.list);
        pManager.AddPointParameter("Cable", "CaP", "Semantic cable points.", GH_ParamAccess.list);
        pManager.AddTextParameter("Metadata", "Meta", "Brepia project metadata.", GH_ParamAccess.item);
    }

    protected override void SolveInstance(IGH_DataAccess DA)
    {
        if (_contractLoadError is not null)
        {
            AddRuntimeMessage(GH_RuntimeMessageLevel.Error, _contractLoadError);
            return;
        }
        if (_contract is null)
        {
            AddRuntimeMessage(
                GH_RuntimeMessageLevel.Remark,
                "No Brepia contract is embedded. Phase 7C adds the load/replace UI and dynamic inputs.");
            return;
        }

        AddRuntimeMessage(
            GH_RuntimeMessageLevel.Remark,
            $"Brepia contract loaded for {_contract.ProjectName} ({_contract.SourceRevisionId}). Dynamic solve wiring is added in Phase 7C.");
    }

    public override bool Write(GH_IWriter writer)
    {
        if (_contract is not null)
        {
            writer.SetString(ContractArchiveKey, _contract.NormalizedJson);
        }
        return base.Write(writer);
    }

    public override bool Read(GH_IReader reader)
    {
        _contract = null;
        _contractLoadError = null;
        if (reader.ItemExists(ContractArchiveKey))
        {
            try
            {
                _contract = BrepiaGrasshopperContract.Parse(reader.GetString(ContractArchiveKey));
                NickName = _contract.ProjectName;
            }
            catch (Exception error)
            {
                _contractLoadError = $"Embedded Brepia contract is invalid: {error.Message}";
            }
        }
        return base.Read(reader);
    }
}
