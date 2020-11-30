import {
    Scene, Camera, Group, PointLight,
    Mesh, MeshBasicMaterial, Line, LineBasicMaterial,
    RingGeometry, PlaneGeometry, BufferGeometry,
    Raycaster, Vector2, Vector3, MathUtils, Object3D, Color
} from "three";
import TWEEN, {Tween} from "@tweenjs/tween.js";
import { Map } from "./Map";
import { Marker } from "./Marker";

export class MapCursor {
    private _cursor: Group = new Group();
    private _ring: Mesh;
    private _ringMaterial: MeshBasicMaterial;
    private _ringSrcData = {
        innerRadius: 0.035,
        outerRadius: 0.0425,
        thetaSegments: 16
    };
    private _ringData = {
        innerRadius: this._ringSrcData.innerRadius,
        outerRadius: this._ringSrcData.outerRadius,
        thetaSegments: this._ringSrcData.thetaSegments
    };
    private _light: PointLight;
    private _verticalLine: Line;
    private _horizontalLine: Line;

    private _scene: Scene;
    private readonly _camera: Camera;
    private _map: Map;
    private readonly _mapMesh: Mesh;
    private _markersGroup: Group;

    private _overedMarker: Object3D = null;
    private _lastOveredMarkerPosition: Vector3 = new Vector3();

    private _enterExitTweenGroup = new TWEEN.Group();

    private _raycaster: Raycaster = new Raycaster();
    private _mapPosition: Vector3 = new Vector3();
    private _magnetizationToMarker = {
        value: 0,
        duration: 500
    };
    private _mouseScreenPosition: Vector2 = new Vector2();

    private _isBlocked: boolean = false;

    constructor(scene: Scene, camera: Camera, map: Map) {
        this._scene = scene;
        this._camera = camera;
        this._map = map;
        this._mapMesh = map.mesh;
        this._markersGroup = map.markersGroup;
        this.init();
    } 

    private init = (): void => {
        this._light = new PointLight(0xffffff, 3, 0.5)
        this._light.position.z = 0.15;

        this._ringMaterial = new MeshBasicMaterial({ color: 0xffffff });
        this._ring = new Mesh(
            new RingGeometry(
                this._ringSrcData.innerRadius,
                this._ringSrcData.outerRadius,
                this._ringSrcData.thetaSegments),
            this._ringMaterial
            );

        this._cursor.add(this._ring);
        this._scene.add(this._cursor, this._light);

        const planeGeometry = <PlaneGeometry>this._mapMesh.geometry;
        const lineMaterial = new LineBasicMaterial({ color: 0xd0d0d0 });

        const lineVerticalGeometry = new BufferGeometry().setFromPoints([
            new Vector3(0,  planeGeometry.parameters.height / 2, 0),
            new Vector3(0, -planeGeometry.parameters.height / 2, 0)]);
        this._verticalLine = new Line(lineVerticalGeometry, lineMaterial);

        const lineHorizontalGeometry = new BufferGeometry().setFromPoints([
            new Vector3(planeGeometry.parameters.width / 2, 0, 0),
            new Vector3(-planeGeometry.parameters.width / 2, 0, 0)]);
        this._horizontalLine = new Line(lineHorizontalGeometry, lineMaterial);

        this._scene.add(this._horizontalLine, this._verticalLine);
    }

    public update = (): void => {
        this._enterExitTweenGroup.update();
        this.setCursorPositionMagically();
    }

    public positioning = (mousePosition: Vector2) => {
        this._mouseScreenPosition = mousePosition;
        const mouseCoords = {
            x: (mousePosition.x / window.innerWidth) * 2 - 1,
            y: -(mousePosition.y / window.innerHeight) * 2 + 1
        };

        this._raycaster.setFromCamera(mouseCoords, this._camera);

        const mapIntersection = this._raycaster.intersectObject(this._mapMesh)[0];

        mapIntersection != null &&
        this._mapPosition.copy(mapIntersection.point);

        const markerIntersection = this._raycaster.intersectObjects(this._markersGroup.children)[0];

        if (markerIntersection == null){
            this._overedMarker != null &&
            this.onMarkerExit(this._overedMarker);
        } else {
            if (this._overedMarker == null) {
                this.onMarkerEnter(markerIntersection.object);
            } else {
                if (this._overedMarker != markerIntersection.object) {
                    this.onMarkerExit(this._overedMarker);
                    this.onMarkerEnter(markerIntersection.object);
                }
            }
        }
    }

    private setCursorPositionMagically = (): void => {
        let markerWorldPositionForLerp = new Vector3();

        if (this._overedMarker != null) {
            this._overedMarker.getWorldPosition(markerWorldPositionForLerp);
        } else {
            markerWorldPositionForLerp.copy(this._lastOveredMarkerPosition);
        }

        const position = new Vector3().lerpVectors(
            this._mapPosition, markerWorldPositionForLerp, this._magnetizationToMarker.value);

        const alpha = 0.15;
        this._cursor.position.lerpVectors(this._cursor.position, position, alpha);

        this._horizontalLine.position.y = MathUtils.lerp(this._horizontalLine.position.y, position.y, alpha);
        this._verticalLine.position.x = MathUtils.lerp(this._verticalLine.position.x, position.x, alpha);

        this._light.position.x = this._mapPosition.x;
        this._light.position.y = this._mapPosition.y;
    }

    public setOveredMarkerSelection = async () => {
        if (this._overedMarker == null) return;

        const markerObj = this._overedMarker;
        const marker = <Marker>markerObj.userData.marker;
        marker.visualGroup.scale.multiplyScalar(0.5);

        if (marker.isSelected) {
            marker.beSelected(false);
            this._map.backFromMarker();

            console.log("Back from " + marker.data.title)
        } else {
            marker.beSelected(true);
            this._map.goToMarker(markerObj);

            console.log("Go to " + marker.data.title)
        }

        this.onMarkerExit(markerObj);

        document.body.style.cursor = 'default';
        this._isBlocked = true;
        await setTimeout(() => {this._isBlocked = false}, this._map.zoomDuration);
    }


    private onMarkerEnter = (markerObject: Object3D): void => {
        if (this._isBlocked) return;

        this._overedMarker = markerObject;
        document.body.style.cursor = 'pointer';

        const marker = <Marker>markerObject.userData.marker;
        marker.setMouseOveringStyle(true, this._mouseScreenPosition);

        this._enterExitTweenGroup.removeAll();
        this._enterExitTweenGroup = new TWEEN.Group();

        new Tween(this._magnetizationToMarker, this._enterExitTweenGroup)
            .to({ value: 0.9 }, this._magnetizationToMarker.duration)
            .start();

        let tempColor = { hex: this._ringMaterial.color.getHex() };
        new Tween(tempColor, this._enterExitTweenGroup)
            .to({ hex: new Color(0x000000).getHex() }, this._magnetizationToMarker.duration / 2)
            .start()
            .onUpdate(() => this._ringMaterial.color.setHex(tempColor.hex));

        this.tweenRingGeometry(
            0.001,
            0.065,
            4,
            this._magnetizationToMarker.duration / 2);

        this._enterExitTweenGroup.update(this._magnetizationToMarker.duration);
    }

    private onMarkerExit = (markerObject: Object3D): void => {
        this._overedMarker.getWorldPosition(this._lastOveredMarkerPosition);
        this._overedMarker = null;
        document.body.style.cursor = 'default';

        const marker = <Marker>markerObject.userData.marker;
        marker.setMouseOveringStyle(false, this._mouseScreenPosition);

        this._enterExitTweenGroup.removeAll();

        new Tween(this._magnetizationToMarker, this._enterExitTweenGroup)
            .to({ value: 0 }, this._magnetizationToMarker.duration)
            .start();

        let tempColor = { hex: this._ringMaterial.color.getHex() };
        new Tween(tempColor, this._enterExitTweenGroup)
            .to({ hex: new Color(0xffffff).getHex() }, this._magnetizationToMarker.duration / 2)
            .start()
            .onUpdate(() => this._ringMaterial.color.setHex(tempColor.hex));

        this.tweenRingGeometry(
            0.035,
            0.0425,
            16,
            this._magnetizationToMarker.duration);

        this._enterExitTweenGroup.update(this._magnetizationToMarker.duration);
    }

    private tweenRingGeometry = (innerRadius: number,
                                 outerRadius: number,
                                 thetaSegments: number,
                                 duration: number): void => {
        new Tween(this._ringData, this._enterExitTweenGroup)
            .to({ innerRadius, outerRadius, thetaSegments }, duration)
            .start()
            .onUpdate(() => {
                this._ring.geometry.dispose();
                this._ring.geometry = new RingGeometry(
                    this._ringData.innerRadius,
                    this._ringData.outerRadius,
                    Math.round(this._ringData.thetaSegments)
                )
            })
    }
}